import { describe, expect, test } from "bun:test";
import type { BlockId, OrganizationId, UserId } from "@orcai/core";
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
} from "@/lib/authz/resource-access";
import { setListing } from "@/lib/catalogue/listing";
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
	kind: "member" as const,
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

/** The block's home organisation, where these tests issue grants. */
const homeOf = (blockId: BlockId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [scope] = yield* db
			.select({
				organizationId: dbSchema.resourceScope.organizationId,
			})
			.from(dbSchema.resourceScope)
			.where(
				and(
					eq(dbSchema.resourceScope.resourceId, blockId),
					eq(dbSchema.resourceScope.isPrimary, true),
				),
			);
		return scope.organizationId;
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
			organizationId: owner.session.activeOrganizationId as OrganizationId,
			principals: [
				principal,
			],
			role,
			actor: actorOf(owner),
		}),
	);

const revoke = (blockId: BlockId, principal: GrantPrincipal) =>
	run(
		Effect.gen(function* () {
			return yield* revokeResourceAccess({
				resource: block(blockId),
				organizationId: yield* homeOf(blockId),
				principal,
			});
		}),
	);

const setVisibility =
	(
		owner: Actor,
		blockId: BlockId,
		visibility: "public" | "private",
		zedToken: string | undefined,
	) =>
	() =>
		run(
			setListing({
				resource: block(blockId),
				visibility,
				listBlockIds: [],
				actor: {
					userId: owner.user.id,
					zedToken,
				},
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
	const { blockId, zedToken: created } = await createBlock(owner, zedToken);
	return {
		organizationId,
		owner,
		others,
		blockId,
		zedToken: created,
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
			const { organizationId, owner, blockId, zedToken } = await ownedBlock([]);
			await queueBehindOrganizationLock(
				organizationId,
				setVisibility(owner, blockId, "public", zedToken),
				setVisibility(owner, blockId, "private", zedToken),
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
			const { organizationId, owner, blockId, zedToken } = await ownedBlock([]);
			await queueBehindOrganizationLock(
				organizationId,
				setVisibility(owner, blockId, "private", zedToken),
				setVisibility(owner, blockId, "public", zedToken),
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
		"deleting the organization deletes the resources it is home to with their grants and tuples",
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
				tuples: [],
			});
			expect(
				await run(
					Effect.gen(function* () {
						const db = yield* DB;
						return yield* db
							.select({
								id: dbSchema.block.id,
							})
							.from(dbSchema.block)
							.where(eq(dbSchema.block.id, blockId));
					}),
				),
			).toEqual([]);
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
				zedToken,
			} = await ownedBlock([]);
			await run(
				Effect.gen(function* () {
					const db = yield* DB;
					yield* db.insert(dbSchema.resourceGrant).values({
						...block(blockId),
						...user(account.user.id),
						role: "viewer",
						organizationId: grantOrganizationId,
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
				setVisibility(owner, blockId, "private", zedToken),
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

/**
 * A block homed in one organisation and scoped to a second one as installs
 * will be, with a member of both and a sharer in the second.
 */
const blockInTwoOrganizations = async () => {
	const home = await ownedBlock([
		"member",
	]);
	const [member] = home.others;
	const { organizationId: otherOrganizationId, actors } =
		await organizationWith([
			"admin",
		]);
	const [sharer] = actors;
	await run(
		Effect.gen(function* () {
			const db = yield* DB;
			yield* db.insert(dbSchema.member).values({
				organizationId: otherOrganizationId,
				userId: member.user.id,
				role: "member",
			});
			yield* db.insert(dbSchema.resourceScope).values({
				...block(home.blockId),
				organizationId: otherOrganizationId,
				isPrimary: false,
				assignedBy: sharer.user.id,
			});
		}),
	);
	const grantInOther = (role: ResourceGrantRole) =>
		run(
			grantResourceAccess({
				resource: block(home.blockId),
				organizationId: otherOrganizationId,
				principals: [
					user(member.user.id),
				],
				role,
				actor: actorOf(sharer),
			}),
		);
	const revokeInOther = () =>
		run(
			revokeResourceAccess({
				resource: block(home.blockId),
				organizationId: otherOrganizationId,
				principal: user(member.user.id),
			}),
		);
	return {
		...home,
		member,
		sharer,
		otherOrganizationId,
		grantInOther,
		revokeInOther,
	};
};

describe("grant provenance", () => {
	test(
		"a home editor grant and another organisation's viewer grant coexist, and revoking one keeps the other's tuple",
		async () => {
			const { owner, member, blockId, grantInOther, revokeInOther } =
				await blockInTwoOrganizations();
			await grant(owner, blockId, user(member.user.id), "editor");
			await grantInOther("viewer");
			expect(await accessOf(blockId, member.user.id)).toEqual({
				grants: [
					`editor@${member.user.id}`,
					`viewer@${member.user.id}`,
				],
				tuples: [
					`editor@user:${member.user.id}`,
					`owner@user:${owner.user.id}`,
					`viewer@user:${member.user.id}`,
				].sort(),
			});

			await revokeInOther();
			expect(await accessOf(blockId, member.user.id)).toEqual({
				grants: [
					`editor@${member.user.id}`,
				],
				tuples: [
					`editor@user:${member.user.id}`,
					`owner@user:${owner.user.id}`,
				].sort(),
			});
		},
		TIMEOUT,
	);

	test(
		"revoking one of two grants of the same role keeps its tuple",
		async () => {
			const { owner, member, blockId, grantInOther, revokeInOther } =
				await blockInTwoOrganizations();
			await grant(owner, blockId, user(member.user.id));
			await grantInOther("viewer");
			await revokeInOther();
			expect(await accessOf(blockId, member.user.id)).toEqual({
				grants: [
					`viewer@${member.user.id}`,
				],
				tuples: [
					`owner@user:${owner.user.id}`,
					`viewer@user:${member.user.id}`,
				].sort(),
			});
		},
		TIMEOUT,
	);

	test(
		"leaving an organisation revokes only the grants issued there",
		async () => {
			const {
				owner,
				member,
				sharer,
				blockId,
				otherOrganizationId,
				grantInOther,
			} = await blockInTwoOrganizations();
			await grant(owner, blockId, user(member.user.id), "editor");
			await grantInOther("viewer");
			await run(
				removeMembers({
					organizationId: otherOrganizationId,
					userIds: [
						member.user.id,
					],
					actor: actorOf(sharer),
				}),
			);
			expect(await accessOf(blockId, member.user.id)).toEqual({
				grants: [
					`editor@${member.user.id}`,
				],
				tuples: [
					`editor@user:${member.user.id}`,
					`owner@user:${owner.user.id}`,
				].sort(),
			});
		},
		TIMEOUT,
	);

	test(
		"removals from both organisations at once leave no tuple behind",
		async () => {
			const {
				owner,
				member,
				sharer,
				blockId,
				organizationId,
				otherOrganizationId,
				grantInOther,
			} = await blockInTwoOrganizations();
			await grant(owner, blockId, user(member.user.id));
			await grantInOther("viewer");
			const removeFrom = (from: OrganizationId, actor: Actor) => () =>
				run(
					removeMembers({
						organizationId: from,
						userIds: [
							member.user.id,
						],
						actor: actorOf(actor),
					}),
				);
			// Each removal locks both organisations, the lower id first, so both queue behind it.
			const [firstLocked] = [
				organizationId,
				otherOrganizationId,
			].sort();
			await queueBehindOrganizationLock(
				firstLocked,
				removeFrom(organizationId, owner),
				removeFrom(otherOrganizationId, sharer),
			);
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
		"a grant in an organisation the resource is not scoped to is refused",
		async () => {
			const {
				blockId,
				others: [member],
			} = await ownedBlock([
				"member",
			]);
			const { organizationId: otherOrganizationId, actors } =
				await organizationWith([
					"admin",
				]);
			const rejected = await rejection(
				run(
					grantResourceAccess({
						resource: block(blockId),
						organizationId: otherOrganizationId,
						principals: [
							user(member.user.id),
						],
						role: "viewer",
						actor: actorOf(actors[0]),
					}),
				),
			);
			expect(rejected).toMatchObject({
				reason: "RESOURCE_SCOPE_REQUIRED",
			});
		},
		TIMEOUT,
	);
});
