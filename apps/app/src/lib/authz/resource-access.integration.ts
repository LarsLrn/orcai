import { describe, expect, test } from "bun:test";
import type { BlockId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ResourceGrantRole } from "@orcai/schema";
import { and, eq, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	queueBehindOrganizationLock,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { deleteOrganizationsWithAuthorization } from "@/lib/authz/organization-lifecycle";
import {
	deleteAccounts,
	removeMembers,
} from "@/lib/authz/organization-membership";
import type { GrantPrincipal } from "@/lib/authz/relationship-facts";
import {
	grantResourceAccess,
	revokeResourceAccess,
	setResourceVisibility,
} from "@/lib/authz/resource-access";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const {
	run,
	organizationWith,
	createBlock,
	procedureOptions,
	outboxDelivered,
	readTuples,
	instanceAdmin,
} = authzIntegration();

const rejection = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: unknown) => error,
	);

const actorOf = (actor: Actor) => ({
	userId: actor.user.id,
	zedToken: undefined,
});

const block = (blockId: BlockId) => ({
	resourceType: "block" as const,
	resourceId: blockId,
});

const user = (userId: UserId): GrantPrincipal => ({
	principalType: "user",
	principalId: userId,
});

const grant = (
	owner: Actor,
	blockId: BlockId,
	principal: GrantPrincipal,
	role: ResourceGrantRole = "viewer",
) =>
	run(
		grantResourceAccess({
			resource: block(blockId),
			principals: [
				principal,
			],
			role,
			actor: actorOf(owner),
		}),
	);

const revoke = (blockId: BlockId, principal: GrantPrincipal) =>
	run(
		revokeResourceAccess({
			resource: block(blockId),
			principal,
		}),
	);

const setVisibility =
	(owner: Actor, blockId: BlockId, visibility: "public" | "private") => () =>
		run(
			setResourceVisibility({
				resource: block(blockId),
				visibility,
				actorId: owner.user.id,
			}),
		);

/** The active grants on the block as `role@principalId`, and its tuples. */
const accessOf = async (blockId: BlockId, settledId: string) => {
	await outboxDelivered(settledId);
	const grants = await run(
		Effect.gen(function* () {
			const db = yield* DB;
			return yield* db
				.select({
					role: dbSchema.resourceGrant.role,
					principalId: dbSchema.resourceGrant.principalId,
				})
				.from(dbSchema.resourceGrant)
				.where(
					and(
						eq(dbSchema.resourceGrant.resourceId, blockId),
						isNull(dbSchema.resourceGrant.revokedAt),
					),
				);
		}),
	);
	return {
		grants: grants.map((row) => `${row.role}@${row.principalId}`).sort(),
		tuples: await readTuples({
			resourceType: "block",
			resourceId: blockId,
		}),
	};
};

const ownedBlock = async (roles: readonly ("admin" | "member")[]) => {
	const { organizationId, actors, zedToken } = await organizationWith([
		"admin",
		...roles,
	]);
	const [owner, ...others] = actors;
	const { blockId } = await createBlock(owner, zedToken);
	return {
		organizationId,
		owner,
		others,
		blockId,
		zedToken,
	};
};

describe("grant and revoke", () => {
	test(
		"a grant queued after a revoke leaves the grant in both stores",
		async () => {
			const {
				organizationId,
				owner,
				others: [viewer],
				blockId,
			} = await ownedBlock([
				"member",
			]);
			await grant(owner, blockId, user(viewer.user.id));
			await queueBehindOrganizationLock(
				organizationId,
				() => revoke(blockId, user(viewer.user.id)),
				() => grant(owner, blockId, user(viewer.user.id)),
			);
			expect(await accessOf(blockId, viewer.user.id)).toEqual({
				grants: [
					`viewer@${viewer.user.id}`,
				],
				tuples: [
					`owner@user:${owner.user.id}`,
					`viewer@user:${viewer.user.id}`,
				],
			});
		},
		TIMEOUT,
	);

	test(
		"a revoke queued after a grant leaves no grant in either store",
		async () => {
			const {
				organizationId,
				owner,
				others: [viewer],
				blockId,
			} = await ownedBlock([
				"member",
			]);
			await grant(owner, blockId, user(viewer.user.id));
			await queueBehindOrganizationLock(
				organizationId,
				() => grant(owner, blockId, user(viewer.user.id)),
				() => revoke(blockId, user(viewer.user.id)),
			);
			expect(await accessOf(blockId, viewer.user.id)).toEqual({
				grants: [],
				tuples: [
					`owner@user:${owner.user.id}`,
				],
			});
		},
		TIMEOUT,
	);

	test(
		"of two revokes of the last two managers, the second is rejected",
		async () => {
			const {
				organizationId,
				owner,
				others: [first, second],
				blockId,
			} = await ownedBlock([
				"member",
				"member",
			]);
			await grant(owner, blockId, user(first.user.id), "manager");
			await grant(owner, blockId, user(second.user.id), "manager");
			let rejected: unknown;
			await queueBehindOrganizationLock(
				organizationId,
				() => revoke(blockId, user(first.user.id)),
				async () => {
					rejected = await rejection(revoke(blockId, user(second.user.id)));
				},
			);
			expect(rejected).toMatchObject({
				reason: "LAST_MANAGER_REQUIRED",
			});
			expect(await accessOf(blockId, first.user.id)).toEqual({
				grants: [
					`manager@${second.user.id}`,
				],
				tuples: [
					`manager@user:${second.user.id}`,
					`owner@user:${owner.user.id}`,
				],
			});
		},
		TIMEOUT,
	);

	test(
		"a grant queued after the grantee's removal is rejected",
		async () => {
			const {
				organizationId,
				owner,
				others: [member],
				blockId,
			} = await ownedBlock([
				"member",
			]);
			let rejected: unknown;
			await queueBehindOrganizationLock(
				organizationId,
				() =>
					run(
						removeMembers({
							organizationId,
							userIds: [
								member.user.id,
							],
							actor: actorOf(owner),
						}),
					),
				async () => {
					rejected = await rejection(
						grant(owner, blockId, user(member.user.id)),
					);
				},
			);
			expect(rejected).toMatchObject({
				reason: "GRANT_PRINCIPALS_INVALID",
				params: {
					rejections: [
						{
							principalId: member.user.id,
							reason: "USER_NOT_IN_SCOPE",
						},
					],
				},
			});
			expect(await accessOf(blockId, member.user.id)).toEqual({
				grants: [],
				tuples: [
					`owner@user:${owner.user.id}`,
				],
			});
		},
		TIMEOUT,
	);

	test(
		"a grant queued after its group's deletion is rejected",
		async () => {
			const procedures = await run(Procedures);
			const { organizationId, owner, blockId, zedToken } = await ownedBlock([]);
			const { data: group } = await run(
				procedures.group.create(
					{
						name: "Integration group",
						description: null,
					},
					await procedureOptions(owner, zedToken),
				),
			);
			const principal: GrantPrincipal = {
				principalType: "group",
				principalId: group.id,
			};
			let rejected: unknown;
			await queueBehindOrganizationLock(
				organizationId,
				async () =>
					run(
						procedures.group.delete(
							{
								refs: [
									{
										id: group.id,
									},
								],
							},
							await procedureOptions(owner, zedToken),
						),
					),
				async () => {
					rejected = await rejection(grant(owner, blockId, principal));
				},
			);
			expect(rejected).toMatchObject({
				reason: "GRANT_PRINCIPALS_INVALID",
				params: {
					rejections: [
						{
							principalId: group.id,
							reason: "GROUP_NOT_IN_SCOPE",
						},
					],
				},
			});
			expect(await accessOf(blockId, group.id)).toEqual({
				grants: [],
				tuples: [
					`owner@user:${owner.user.id}`,
				],
			});
		},
		TIMEOUT,
	);
});

describe("visibility", () => {
	const visibilityOf = async (blockId: BlockId) => {
		await outboxDelivered(blockId);
		const [row] = await run(
			Effect.gen(function* () {
				const db = yield* DB;
				return yield* db
					.select({
						visibility: dbSchema.resourceVisibility.visibility,
					})
					.from(dbSchema.resourceVisibility)
					.where(eq(dbSchema.resourceVisibility.resourceId, blockId));
			}),
		);
		return {
			visibility: row?.visibility,
			tuples: await readTuples({
				resourceType: "block",
				resourceId: blockId,
				subjectId: "*",
			}),
		};
	};

	test(
		"private queued after public leaves the resource private in both stores",
		async () => {
			const { organizationId, owner, blockId } = await ownedBlock([]);
			await queueBehindOrganizationLock(
				organizationId,
				setVisibility(owner, blockId, "public"),
				setVisibility(owner, blockId, "private"),
			);
			expect(await visibilityOf(blockId)).toEqual({
				visibility: "private",
				tuples: [],
			});
		},
		TIMEOUT,
	);

	test(
		"public queued after private leaves the resource public in both stores",
		async () => {
			const { organizationId, owner, blockId } = await ownedBlock([]);
			await queueBehindOrganizationLock(
				organizationId,
				setVisibility(owner, blockId, "private"),
				setVisibility(owner, blockId, "public"),
			);
			expect(await visibilityOf(blockId)).toEqual({
				visibility: "public",
				tuples: [
					"public@user:*",
				],
			});
		},
		TIMEOUT,
	);
});

describe("detaching principals that leave", () => {
	test(
		"removing a resource's last manager from the organization revokes the grant",
		async () => {
			const {
				organizationId,
				owner,
				others: [manager],
				blockId,
			} = await ownedBlock([
				"member",
			]);
			await grant(owner, blockId, user(manager.user.id), "manager");
			await run(
				removeMembers({
					organizationId,
					userIds: [
						manager.user.id,
					],
					actor: actorOf(owner),
				}),
			);
			expect(await accessOf(blockId, manager.user.id)).toEqual({
				grants: [],
				tuples: [
					`owner@user:${owner.user.id}`,
				],
			});
		},
		TIMEOUT,
	);

	test(
		"deleting the organization revokes its members' grants on resources scoped only to it",
		async () => {
			const {
				organizationId,
				owner,
				others: [viewer],
				blockId,
			} = await ownedBlock([
				"member",
			]);
			await grant(owner, blockId, user(viewer.user.id));
			await run(
				deleteOrganizationsWithAuthorization([
					organizationId,
				]),
			);
			expect(await accessOf(blockId, viewer.user.id)).toEqual({
				grants: [],
				tuples: [
					`owner@user:${owner.user.id}`,
				],
			});
		},
		TIMEOUT,
	);

	test(
		"deleting an account waits for an organization where it holds only a grant",
		async () => {
			const {
				actors: [account],
			} = await organizationWith([
				"member",
			]);
			const {
				organizationId: grantOrganizationId,
				owner,
				blockId,
			} = await ownedBlock([]);
			await run(
				Effect.gen(function* () {
					const db = yield* DB;
					yield* db.insert(dbSchema.resourceGrant).values({
						...block(blockId),
						...user(account.user.id),
						role: "viewer",
						grantedBy: owner.user.id,
					});
				}),
			);
			const admin = await instanceAdmin(grantOrganizationId);
			await queueBehindOrganizationLock(
				grantOrganizationId,
				() =>
					run(
						deleteAccounts({
							userIds: [
								account.user.id,
							],
							actorId: admin.user.id,
						}),
					),
				setVisibility(owner, blockId, "private"),
			);
			expect(await accessOf(blockId, account.user.id)).toEqual({
				grants: [],
				tuples: [
					`owner@user:${owner.user.id}`,
				],
			});
		},
		TIMEOUT,
	);
});
