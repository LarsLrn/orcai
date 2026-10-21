import { afterAll, describe, expect, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import { v1 } from "@authzed/authzed-node";
import {
	type BlockId,
	type GroupId,
	INSTANCE_ADMIN_ROLE,
	type OrganizationId,
	type OrganizationRole,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@orcai/schema";
import { SpiceDbService, type TupleMutation } from "@orcai/spice-db";
import {
	createOrganization,
	createUser,
	IntegrationLive,
} from "@orcai/testing";
import { and, count, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { Client } from "pg";
import { AppLayer } from "@/lib/effect/app-layer";
import {
	AuthzLive,
	AuthzService,
	enqueueRelationshipMutations,
} from "@/lib/effect/services/authz";
import { blockProcedures } from "@/lib/orpc/router/block";
import { groupProcedures } from "@/lib/orpc/router/group";
import { organizationProcedures } from "@/lib/orpc/router/organization";
import { organizationMemberProcedures } from "@/lib/orpc/router/organization-member";
import { resourceProcedures } from "@/lib/orpc/router/resource";

const runtime = ManagedRuntime.make(Layer.mergeAll(AppLayer, IntegrationLive));
afterAll(() => runtime.dispose());

const run = <A, E>(
	effect: Effect.Effect<
		A,
		E,
		ManagedRuntime.ManagedRuntime.Services<typeof runtime>
	>,
) => runtime.runPromise(effect);

const ORGANIZATION_LOCK_SPACE = 72370906;
const TIMEOUT = 30_000;

const until = async (condition: () => Promise<boolean>, what: string) => {
	const deadline = Date.now() + 20_000;
	while (!(await condition())) {
		if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
		await sleep(25);
	}
};

type Actor = Awaited<ReturnType<typeof signIn>>;

/** A user with a real session row whose active organization is set. */
const signIn = (organizationId: OrganizationId, userId: UserId) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const now = new Date();
			const [user] = yield* db
				.select()
				.from(dbSchema.user)
				.where(eq(dbSchema.user.id, userId));
			const [session] = yield* db
				.insert(dbSchema.session)
				.values({
					token: crypto.randomUUID(),
					userId,
					activeOrganizationId: organizationId,
					expiresAt: new Date(now.getTime() + 3_600_000),
					createdAt: now,
					updatedAt: now,
				})
				.returning();
			return {
				user,
				session,
			};
		}),
	);

const procedureOptions = async (actor: Actor, zedToken?: string) => ({
	context: {
		"effect/context": await runtime.context(),
		reqHeaders: new Headers(),
		secureCookies: false,
		meta: {
			zedToken,
		},
		auth: {
			isAuthenticated: true as const,
			session: actor.session,
			user: actor.user,
		},
	},
});

/** An organization with fresh users in `roles`, each signed in to it. */
const organizationWith = async (roles: readonly OrganizationRole[]) => {
	const users = await Promise.all(roles.map(() => run(createUser())));
	const { organization, zedToken } = await run(
		createOrganization({
			members: users.map((user, index) => ({
				userId: user.id,
				role: roles[index],
			})),
		}),
	);
	const actors = await Promise.all(
		users.map((user) => signIn(organization.id, user.id)),
	);
	return {
		organizationId: organization.id,
		actors,
		zedToken,
	};
};

const createBlock = async (owner: Actor, zedToken?: string) => {
	const { data, meta } = await run(
		blockProcedures.create(
			{
				type: "template",
				name: "Integration block",
				description: null,
				contentJson: null,
				contentHtml: null,
				status: "draft",
				config: {
					systemPrompt: "",
				},
			},
			await procedureOptions(owner, zedToken),
		),
	);
	return {
		blockId: data.id,
		zedToken: meta?.zedToken ?? zedToken,
	};
};

const waitingForOrganizationLock = async (
	client: Client,
	organizationId: OrganizationId,
) => {
	const { rows } = await client.query<{
		waiting: number;
	}>(
		`SELECT count(*)::int AS waiting FROM pg_locks
		 WHERE locktype = 'advisory' AND classid::bigint = $1 AND objsubid = 2
		   AND objid::bigint = (hashtext($2)::bigint & 4294967295) AND NOT granted`,
		[
			ORGANIZATION_LOCK_SPACE,
			organizationId,
		],
	);
	return rows[0].waiting;
};

/**
 * Holds the organization's write lock from another connection, queues `first`
 * then `second` behind it, checks neither finishes while it is held, and
 * releases it so Postgres runs them in queue order.
 */
const queueBehindOrganizationLock = async (
	organizationId: OrganizationId,
	first: () => Promise<unknown>,
	second: () => Promise<unknown>,
) => {
	const client = new Client({
		host: process.env.POSTGRES_HOST,
		port: Number(process.env.POSTGRES_PORT),
		user: process.env.POSTGRES_USER,
		password: process.env.POSTGRES_PASSWORD,
		database: process.env.POSTGRES_DB,
	});
	await client.connect();
	const finished: boolean[] = [];
	const start = (operation: () => Promise<unknown>) => {
		const index = finished.push(false) - 1;
		const settled = Promise.allSettled([
			operation(),
		]).then(([outcome]) => {
			finished[index] = true;
			return outcome;
		});
		return settled;
	};
	try {
		await client.query("BEGIN");
		await client.query("SELECT pg_advisory_xact_lock($1, hashtext($2))", [
			ORGANIZATION_LOCK_SPACE,
			organizationId,
		]);
		const outcomes = [
			start(first),
		];
		await until(
			async () =>
				(await waitingForOrganizationLock(client, organizationId)) === 1,
			"the first operation to wait",
		);
		outcomes.push(start(second));
		await until(
			async () =>
				(await waitingForOrganizationLock(client, organizationId)) === 2,
			"the second operation to wait",
		);
		await sleep(200);
		expect(finished).toEqual([
			false,
			false,
		]);
		await client.query("COMMIT");
		for (const outcome of await Promise.all(outcomes)) {
			if (outcome.status === "rejected") throw outcome.reason;
		}
	} finally {
		await client.query("ROLLBACK").catch(() => undefined);
		await client.end();
	}
};

/** Waits until every outbox event mentioning `id` is delivered. */
const outboxDelivered = (id: string) =>
	until(
		() =>
			run(
				Effect.gen(function* () {
					const db = yield* DB;
					const [row] = yield* db
						.select({
							pending: count(),
						})
						.from(dbSchema.authzOutbox)
						.where(
							and(
								sql`${dbSchema.authzOutbox.payloadJson}::text LIKE ${`%${id}%`}`,
								ne(dbSchema.authzOutbox.status, "processed"),
							),
						);
					return row.pending === 0;
				}),
			),
		`the outbox events for ${id}`,
	);

/**
 * `relation@type:id#relation` of the tuples on a resource, fully consistent;
 * only those of user `subjectId` when given.
 */
const readTuples = (filter: {
	resourceType: string;
	resourceId: string;
	subjectId?: string;
}) =>
	run(
		Effect.gen(function* () {
			const { spice } = yield* SpiceDbService;
			const responses = yield* Effect.promise(() =>
				spice.readRelationships(
					v1.ReadRelationshipsRequest.create({
						consistency: v1.Consistency.create({
							requirement: {
								oneofKind: "fullyConsistent",
								fullyConsistent: true,
							},
						}),
						relationshipFilter: v1.RelationshipFilter.create({
							resourceType: filter.resourceType,
							optionalResourceId: filter.resourceId,
							optionalSubjectFilter: filter.subjectId
								? v1.SubjectFilter.create({
										subjectType: "user",
										optionalSubjectId: filter.subjectId,
									})
								: undefined,
						}),
					}),
				),
			);
			return responses
				.flatMap(({ relationship }) =>
					relationship
						? [
								`${relationship.relation}@${relationship.subject?.object?.objectType}:${relationship.subject?.object?.objectId}${relationship.subject?.optionalRelation ? `#${relationship.subject.optionalRelation}` : ""}`,
							]
						: [],
				)
				.sort();
		}),
	);

const viewerTuple = (
	blockId: BlockId,
	subjectId: UserId,
	operation: "touch" | "delete" = "touch",
): TupleMutation => ({
	resourceType: "block",
	resourceId: blockId,
	relation: "viewer",
	subjectType: "user",
	subjectId,
	operation,
});

const outboxStates = (eventIds: readonly string[]) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const rows = yield* db
			.select({
				id: dbSchema.authzOutbox.id,
				status: dbSchema.authzOutbox.status,
				attempts: dbSchema.authzOutbox.attempts,
				retrying: sql<
					boolean | null
				>`${dbSchema.authzOutbox.nextAttemptAt} > now()`,
			})
			.from(dbSchema.authzOutbox)
			.where(
				inArray(dbSchema.authzOutbox.id, [
					...eventIds,
				]),
			);
		return eventIds.map((id) => {
			const row = rows.find((candidate) => candidate.id === id);
			return {
				status: row?.status,
				attempts: row?.attempts,
				retrying: row?.retrying,
			};
		});
	});

class RolledBack extends Data.TaggedError("RolledBack")<{
	readonly value: unknown;
}> {}

/** Runs `body` in a transaction that is rolled back, returning its value. */
const rolledBack = <A, E, R>(body: Effect.Effect<A, E, R>) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db
			.transaction(() =>
				Effect.flatMap(body, (value) =>
					Effect.fail(
						new RolledBack({
							value,
						}),
					),
				),
			)
			.pipe(
				Effect.catch((error) =>
					error instanceof RolledBack
						? Effect.succeed(error.value as A)
						: Effect.fail(error),
				),
			);
	});

describe("grant and revoke of one principal", () => {
	const setup = async () => {
		const {
			organizationId,
			actors: [owner, viewer],
			zedToken: organizationToken,
		} = await organizationWith([
			"admin",
			"member",
		]);
		const { blockId, zedToken } = await createBlock(owner, organizationToken);
		const access = {
			resourceType: "block" as const,
			resourceId: blockId,
			principalType: "user" as const,
			principalId: viewer.user.id,
		};
		const grant = async () =>
			run(
				resourceProcedures.grant(
					{
						resourceType: access.resourceType,
						resourceId: access.resourceId,
						principals: [
							{
								principalType: access.principalType,
								principalId: access.principalId,
							},
						],
						role: "viewer",
					},
					await procedureOptions(owner, zedToken),
				),
			);
		const revoke = async () =>
			run(
				resourceProcedures.revoke(
					access,
					await procedureOptions(owner, zedToken),
				),
			);
		await grant();
		const settled = async () => {
			await outboxDelivered(viewer.user.id);
			const grants = await run(
				Effect.gen(function* () {
					const db = yield* DB;
					return yield* db
						.select({
							role: dbSchema.resourceGrant.role,
						})
						.from(dbSchema.resourceGrant)
						.where(
							and(
								eq(dbSchema.resourceGrant.resourceId, blockId),
								eq(dbSchema.resourceGrant.principalId, viewer.user.id),
								isNull(dbSchema.resourceGrant.revokedAt),
							),
						);
				}),
			);
			return {
				grants: grants.map((grant) => grant.role),
				tuples: await readTuples({
					resourceType: "block",
					resourceId: blockId,
					subjectId: viewer.user.id,
				}),
			};
		};
		return {
			organizationId,
			viewerId: viewer.user.id,
			grant,
			revoke,
			settled,
		};
	};

	test(
		"a grant queued after a revoke leaves the grant in both stores",
		async () => {
			const { organizationId, viewerId, grant, revoke, settled } =
				await setup();
			await queueBehindOrganizationLock(organizationId, revoke, grant);
			expect(await settled()).toEqual({
				grants: [
					"viewer",
				],
				tuples: [
					`viewer@user:${viewerId}`,
				],
			});
		},
		TIMEOUT,
	);

	test(
		"a revoke queued after a grant leaves no grant in either store",
		async () => {
			const { organizationId, grant, revoke, settled } = await setup();
			await queueBehindOrganizationLock(organizationId, grant, revoke);
			expect(await settled()).toEqual({
				grants: [],
				tuples: [],
			});
		},
		TIMEOUT,
	);
});

describe("visibility changes", () => {
	const setup = async () => {
		const {
			organizationId,
			actors: [owner],
			zedToken: organizationToken,
		} = await organizationWith([
			"admin",
		]);
		const { blockId, zedToken } = await createBlock(owner, organizationToken);
		const setVisibility = (visibility: "public" | "private") => async () =>
			run(
				resourceProcedures.setVisibility(
					{
						resourceType: "block",
						resourceId: blockId,
						visibility,
					},
					await procedureOptions(owner, zedToken),
				),
			);
		const settled = async () => {
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
		return {
			organizationId,
			setVisibility,
			settled,
		};
	};

	test(
		"private queued after public leaves the resource private in both stores",
		async () => {
			const { organizationId, setVisibility, settled } = await setup();
			await queueBehindOrganizationLock(
				organizationId,
				setVisibility("public"),
				setVisibility("private"),
			);
			expect(await settled()).toEqual({
				visibility: "private",
				tuples: [],
			});
		},
		TIMEOUT,
	);

	test(
		"public queued after private leaves the resource public in both stores",
		async () => {
			const { organizationId, setVisibility, settled } = await setup();
			await queueBehindOrganizationLock(
				organizationId,
				setVisibility("private"),
				setVisibility("public"),
			);
			expect(await settled()).toEqual({
				visibility: "public",
				tuples: [
					"public@user:*",
				],
			});
		},
		TIMEOUT,
	);
});

describe("member role change and removal", () => {
	test(
		"removing a member queued after a demotion leaves no role in either store",
		async () => {
			const {
				organizationId,
				actors: [admin, demoted],
				zedToken,
			} = await organizationWith([
				"admin",
				"admin",
			]);
			const userId = demoted.user.id;
			await queueBehindOrganizationLock(
				organizationId,
				async () =>
					run(
						organizationMemberProcedures.update(
							{
								userId,
								role: "member",
							},
							await procedureOptions(admin, zedToken),
						),
					),
				async () =>
					run(
						organizationMemberProcedures.delete(
							{
								refs: [
									{
										userId,
									},
								],
							},
							await procedureOptions(admin, zedToken),
						),
					),
			);
			await outboxDelivered(userId);
			const members = await run(
				Effect.gen(function* () {
					const db = yield* DB;
					return yield* db
						.select({
							role: dbSchema.member.role,
						})
						.from(dbSchema.member)
						.where(
							and(
								eq(dbSchema.member.organizationId, organizationId),
								eq(dbSchema.member.userId, userId),
							),
						);
				}),
			);
			expect(members).toEqual([]);
			expect(
				await readTuples({
					resourceType: "organization",
					resourceId: organizationId,
					subjectId: userId,
				}),
			).toEqual([]);
		},
		TIMEOUT,
	);
});

/** An instance admin, signed in to `organizationId` without belonging to it. */
const instanceAdmin = async (organizationId: OrganizationId) => {
	const user = await run(
		createUser({
			role: INSTANCE_ADMIN_ROLE,
		}),
	);
	return signIn(organizationId, user.id);
};

const allMembersGroupOf = (organizationId: OrganizationId) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [group] = yield* db
				.select({
					id: dbSchema.group.id,
				})
				.from(dbSchema.group)
				.where(
					and(
						eq(dbSchema.group.organizationId, organizationId),
						eq(dbSchema.group.systemKey, ALL_MEMBERS_GROUP_SYSTEM_KEY),
					),
				);
			return group.id;
		}),
	);

describe("organization lifecycle", () => {
	test(
		"a created organization has its admin and an All Members group of every role, and deletion removes both",
		async () => {
			const { organizationId: homeId } = await organizationWith([]);
			const admin = await instanceAdmin(homeId);
			const suffix = crypto.randomUUID();
			const { data: organization } = await run(
				organizationProcedures.create(
					{
						name: `Lifecycle ${suffix}`,
						slug: `lifecycle-${suffix}`,
					},
					await procedureOptions(admin),
				),
			);
			const groupId = await allMembersGroupOf(organization.id);
			await outboxDelivered(organization.id);
			expect(
				await readTuples({
					resourceType: "organization",
					resourceId: organization.id,
				}),
			).toEqual([
				`admin@user:${admin.user.id}`,
			]);
			expect(
				await readTuples({
					resourceType: "group",
					resourceId: groupId,
				}),
			).toEqual([
				`member@organization:${organization.id}#admin`,
				`member@organization:${organization.id}#manager`,
				`member@organization:${organization.id}#member`,
				`member@organization:${organization.id}#viewer`,
				`organization@organization:${organization.id}`,
			]);

			await run(
				organizationProcedures.delete(
					{
						refs: [
							{
								id: organization.id,
							},
						],
					},
					await procedureOptions(admin),
				),
			);
			await outboxDelivered(organization.id);
			expect(
				await readTuples({
					resourceType: "organization",
					resourceId: organization.id,
				}),
			).toEqual([]);
			expect(
				await readTuples({
					resourceType: "group",
					resourceId: groupId,
				}),
			).toEqual([]);
		},
		TIMEOUT,
	);

	test(
		"deleting an organization queued after a role change leaves no role in SpiceDB",
		async () => {
			const {
				organizationId,
				actors: [admin, member],
				zedToken,
			} = await organizationWith([
				"admin",
				"member",
			]);
			const deleter = await instanceAdmin(organizationId);
			await queueBehindOrganizationLock(
				organizationId,
				async () =>
					run(
						organizationMemberProcedures.update(
							{
								userId: member.user.id,
								role: "viewer",
							},
							await procedureOptions(admin, zedToken),
						),
					),
				async () =>
					run(
						organizationProcedures.delete(
							{
								refs: [
									{
										id: organizationId,
									},
								],
							},
							await procedureOptions(deleter, zedToken),
						),
					),
			);
			await outboxDelivered(organizationId);
			expect(
				await readTuples({
					resourceType: "organization",
					resourceId: organizationId,
				}),
			).toEqual([]);
		},
		TIMEOUT,
	);
});

describe("group membership", () => {
	const groupMembers = (groupId: GroupId) =>
		run(
			Effect.gen(function* () {
				const db = yield* DB;
				return yield* db
					.select({
						userId: dbSchema.groupMember.userId,
					})
					.from(dbSchema.groupMember)
					.where(
						and(
							eq(dbSchema.groupMember.groupId, groupId),
							isNull(dbSchema.groupMember.removedAt),
						),
					);
			}),
		);

	test(
		"added and removed members are mirrored in SpiceDB",
		async () => {
			const {
				actors: [admin, member],
				zedToken,
			} = await organizationWith([
				"admin",
				"member",
			]);
			const { data: group } = await run(
				groupProcedures.create(
					{
						name: "Integration group",
						description: null,
					},
					await procedureOptions(admin, zedToken),
				),
			);
			const membership = {
				groupId: group.id,
				userIds: [
					member.user.id,
				],
			};
			await run(
				groupProcedures.addMembers(
					membership,
					await procedureOptions(admin, zedToken),
				),
			);
			await outboxDelivered(group.id);
			expect(
				await readTuples({
					resourceType: "group",
					resourceId: group.id,
				}),
			).toEqual([
				`member@user:${member.user.id}`,
				`organization@organization:${group.organizationId}`,
			]);

			await run(
				groupProcedures.removeMembers(
					membership,
					await procedureOptions(admin, zedToken),
				),
			);
			await outboxDelivered(group.id);
			expect(await groupMembers(group.id)).toEqual([]);
			expect(
				await readTuples({
					resourceType: "group",
					resourceId: group.id,
				}),
			).toEqual([
				`organization@organization:${group.organizationId}`,
			]);
		},
		TIMEOUT,
	);

	test(
		"adding a member queued after their removal from the organization is rejected",
		async () => {
			const {
				organizationId,
				actors: [admin, member],
				zedToken,
			} = await organizationWith([
				"admin",
				"member",
			]);
			const { data: group } = await run(
				groupProcedures.create(
					{
						name: "Integration group",
						description: null,
					},
					await procedureOptions(admin, zedToken),
				),
			);
			let rejection: unknown;
			await queueBehindOrganizationLock(
				organizationId,
				async () =>
					run(
						organizationMemberProcedures.delete(
							{
								refs: [
									{
										userId: member.user.id,
									},
								],
							},
							await procedureOptions(admin, zedToken),
						),
					),
				async () =>
					run(
						groupProcedures.addMembers(
							{
								groupId: group.id,
								userIds: [
									member.user.id,
								],
							},
							await procedureOptions(admin, zedToken),
						),
					).catch((error: unknown) => {
						rejection = error;
					}),
			);
			expect(rejection).toMatchObject({
				reason: "GROUP_MEMBERS_INVALID",
			});
			await outboxDelivered(member.user.id);
			expect(await groupMembers(group.id)).toEqual([]);
			expect(
				await readTuples({
					resourceType: "group",
					resourceId: group.id,
					subjectId: member.user.id,
				}),
			).toEqual([]);
		},
		TIMEOUT,
	);
});

describe("ordered delivery", () => {
	test(
		"concurrent deliverers apply alternating events in seq order",
		async () => {
			const {
				actors: [owner],
				zedToken,
			} = await organizationWith([
				"admin",
			]);
			const { blockId } = await createBlock(owner, zedToken);
			const subject = await run(createUser());

			await run(
				Effect.gen(function* () {
					const db = yield* DB;
					const authz = yield* AuthzService;
					const eventIds = (yield* db.transaction(() =>
						Effect.forEach(
							[
								"touch",
								"delete",
								"touch",
								"delete",
								"touch",
							] as const,
							(operation) =>
								enqueueRelationshipMutations([
									viewerTuple(blockId, subject.id, operation),
								]),
						),
					)).flat();
					yield* Effect.all(
						[
							authz.deliverRelationshipEvents(eventIds),
							authz.deliverRelationshipEvents(eventIds),
						],
						{
							concurrency: "unbounded",
						},
					);
				}),
			);

			await outboxDelivered(subject.id);
			expect(
				await readTuples({
					resourceType: "block",
					resourceId: blockId,
					subjectId: subject.id,
				}),
			).toEqual([
				`viewer@user:${subject.id}`,
			]);
		},
		TIMEOUT,
	);
});

describe("failed delivery", () => {
	test(
		"an event SpiceDB rejects is dead-lettered at once and newer events are delivered",
		async () => {
			const {
				actors: [owner],
				zedToken,
			} = await organizationWith([
				"admin",
			]);
			const { blockId } = await createBlock(owner, zedToken);
			const subject = await run(createUser());

			const states = await run(
				Effect.gen(function* () {
					const db = yield* DB;
					const authz = yield* AuthzService;
					const eventIds = (yield* db.transaction(() =>
						Effect.forEach(
							[
								{
									...viewerTuple(blockId, subject.id),
									relation: "not_a_relation",
								},
								{
									...viewerTuple(blockId, subject.id),
									relation: "bot",
								},
								viewerTuple(blockId, subject.id),
							] as TupleMutation[],
							(mutation) =>
								enqueueRelationshipMutations([
									mutation,
								]),
						),
					)).flat();
					yield* authz.deliverRelationshipEvents(eventIds);
					return yield* outboxStates(eventIds);
				}),
			);

			expect(states).toEqual([
				{
					status: "dead_letter",
					attempts: 1,
					retrying: null,
				},
				{
					status: "dead_letter",
					attempts: 1,
					retrying: null,
				},
				{
					status: "processed",
					attempts: 1,
					retrying: null,
				},
			]);
			expect(
				await readTuples({
					resourceType: "block",
					resourceId: blockId,
					subjectId: subject.id,
				}),
			).toEqual([
				`viewer@user:${subject.id}`,
			]);
		},
		TIMEOUT,
	);

	test(
		"an unavailable SpiceDB keeps an event retrying and holds back newer ones",
		async () => {
			const {
				actors: [owner],
				zedToken,
			} = await organizationWith([
				"admin",
			]);
			const { blockId } = await createBlock(owner, zedToken);
			const [unlucky, waiting] = await Promise.all([
				run(createUser()),
				run(createUser()),
			]);
			const unreachable = v1.NewClient(
				"unreachable",
				"127.0.0.1:1",
				v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
			).promises;
			let available = false;
			// Writes about `unlucky` go to a closed port until SpiceDB is available.
			const SometimesUnavailable = Layer.effect(
				SpiceDbService,
				Effect.gen(function* () {
					const { spice } = yield* SpiceDbService;
					return {
						spice: new Proxy(spice, {
							get: (target, key) =>
								key === "writeRelationships"
									? (request: v1.WriteRelationshipsRequest) =>
											!available &&
											request.updates.some(
												(update) =>
													update.relationship?.subject?.object?.objectId ===
													unlucky.id,
											)
												? unreachable.writeRelationships(request)
												: target.writeRelationships(request)
									: Reflect.get(target, key),
						}),
					};
				}),
			);

			// Rolled back, so no other test's delivery waits behind the failing event.
			const states = await run(
				rolledBack(
					Effect.gen(function* () {
						const db = yield* DB;
						const authz = yield* AuthzService;
						const eventIds = [
							...(yield* enqueueRelationshipMutations([
								viewerTuple(blockId, unlucky.id),
							])),
							...(yield* enqueueRelationshipMutations([
								viewerTuple(blockId, waiting.id),
							])),
						];
						const retry = (attempts?: number) =>
							db
								.update(dbSchema.authzOutbox)
								.set({
									nextAttemptAt: null,
									...(attempts === undefined
										? {}
										: {
												attempts,
											}),
								})
								.where(eq(dbSchema.authzOutbox.id, eventIds[0]));

						yield* authz.deliverRelationshipEvents(eventIds);
						const first = yield* outboxStates(eventIds);
						yield* retry(100);
						yield* authz.deliverRelationshipEvents(eventIds);
						const later = yield* outboxStates(eventIds);
						available = true;
						yield* retry();
						yield* authz.deliverRelationshipEvents(eventIds);
						const recovered = yield* outboxStates(eventIds);
						return {
							first,
							later,
							recovered,
						};
					}),
				).pipe(
					Effect.provide(
						Layer.fresh(AuthzLive).pipe(Layer.provide(SometimesUnavailable)),
					),
				),
			).finally(() => {
				unreachable.close();
			});

			const pending = {
				status: "pending" as const,
				attempts: 0,
				retrying: null,
			};
			expect(states).toEqual({
				first: [
					{
						status: "failed",
						attempts: 1,
						retrying: true,
					},
					pending,
				],
				later: [
					{
						status: "failed",
						attempts: 101,
						retrying: true,
					},
					pending,
				],
				recovered: [
					{
						status: "processed",
						attempts: 102,
						retrying: null,
					},
					{
						status: "processed",
						attempts: 1,
						retrying: null,
					},
				],
			});
		},
		TIMEOUT,
	);
});
