import { afterAll, describe, expect, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import { v1 } from "@authzed/authzed-node";
import type {
	BlockId,
	OrganizationId,
	OrganizationRole,
	UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { SpiceDbService } from "@orcai/spice-db";
import {
	createOrganization,
	createUser,
	IntegrationLive,
} from "@orcai/testing";
import { and, count, eq, isNull, ne, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { Client } from "pg";
import { AppLayer } from "@/lib/effect/app-layer";
import {
	AuthzService,
	enqueueRelationshipMutations,
} from "@/lib/effect/services/authz";
import { blockProcedures } from "@/lib/orpc/router/block";
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

/** `relation@type:id` of the tuples on a resource, fully consistent. */
const readTuples = (filter: {
	resourceType: string;
	resourceId: string;
	subjectId: string;
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
							optionalSubjectFilter: v1.SubjectFilter.create({
								subjectType: "user",
								optionalSubjectId: filter.subjectId,
							}),
						}),
					}),
				),
			);
			return responses
				.flatMap(({ relationship }) =>
					relationship
						? [
								`${relationship.relation}@${relationship.subject?.object?.objectType}:${relationship.subject?.object?.objectId}`,
							]
						: [],
				)
				.sort();
		}),
	);

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
			const viewerTuple = (operation: "touch" | "delete") => ({
				resourceType: "block" as const,
				resourceId: blockId as BlockId,
				relation: "viewer" as const,
				subjectType: "user" as const,
				subjectId: subject.id,
				operation,
			});

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
									viewerTuple(operation),
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
