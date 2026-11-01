import { afterAll, expect } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import { v1 } from "@authzed/authzed-node";
import {
	buckets,
	INSTANCE_ADMIN_ROLE,
	type OrganizationId,
	type OrganizationRole,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { PgBossService } from "@orcai/pg-boss";
import { SpiceDbService } from "@orcai/spice-db";
import {
	createJobQueues,
	createOrganization,
	createUser,
	IntegrationLive,
} from "@orcai/testing";
import { and, count, eq, ne, sql } from "drizzle-orm";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { Client } from "pg";
import { writeRelationships } from "@/lib/authz/relationship-write";
import { initializeResourceAuthorization } from "@/lib/authz/resource-lifecycle";
import { AppLayer } from "@/lib/effect/app-layer";
import { AuthzLive } from "@/lib/effect/services/authz";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const ORGANIZATION_LOCK_SPACE = 72370906;
export const TIMEOUT = 30_000;

const JobQueuesLive = Layer.effectDiscard(
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;
		yield* Effect.promise(() => createJobQueues(boss));
	}),
);

const until = async (condition: () => Promise<boolean>, what: string) => {
	const deadline = Date.now() + 20_000;
	while (!(await condition())) {
		if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
		await sleep(25);
	}
};

export type Actor = {
	user: typeof dbSchema.user.$inferSelect;
	session: typeof dbSchema.session.$inferSelect;
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

export /**
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

class RolledBack extends Data.TaggedError("RolledBack")<{
	readonly value: unknown;
}> {}

/**
 * Runs `body` in a transaction that is rolled back, returning its value, so
 * the outbox events it fails hold back no other file once it ends.
 */
export const rolledBack = <A, E, R>(body: Effect.Effect<A, E, R>) =>
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

/**
 * A SpiceDB whose writes naming `objectId` as resource or subject fail until
 * `recover` is called: sent to a closed port, or naming a relation the schema
 * lacks. Other files' events, which a delivery may reach first, still succeed.
 */
export const failingWritesAbout = (
	objectId: string,
	failure: "unavailable" | "schema not applied",
) => {
	const unreachable = v1.NewClient(
		"unreachable",
		"127.0.0.1:1",
		v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
	).promises;
	let failing = true;
	const spiceDb = Layer.effect(
		SpiceDbService,
		Effect.gen(function* () {
			const { spice } = yield* SpiceDbService;
			const writeRelationships = (request: v1.WriteRelationshipsRequest) => {
				if (
					!failing ||
					!request.updates.some(
						({ relationship }) =>
							relationship?.resource?.objectId === objectId ||
							relationship?.subject?.object?.objectId === objectId,
					)
				)
					return spice.writeRelationships(request);
				if (failure === "unavailable")
					return unreachable.writeRelationships(request);
				return spice.writeRelationships({
					...request,
					updates: request.updates.map((update) => ({
						...update,
						relationship: update.relationship && {
							...update.relationship,
							relation: "not_yet_in_schema",
						},
					})),
				});
			};
			return {
				spice: new Proxy(spice, {
					get: (target, key) =>
						key === "writeRelationships"
							? writeRelationships
							: Reflect.get(target, key),
				}),
			};
		}),
	);
	return {
		authz: Layer.fresh(AuthzLive).pipe(Layer.provide(spiceDb)),
		recover: () => {
			failing = false;
		},
		close: () => {
			unreachable.close();
		},
	};
};

/**
 * The app's layers over the stack, disposed after the file, with helpers that
 * create organizations, users and resources and read both stores.
 */
export const authzIntegration = () => {
	// Loading the router while the app layer builds blocks the event loop for
	// seconds, so the instance check connects only once it is built.
	const runtime = ManagedRuntime.make(
		Layer.mergeAll(IntegrationLive, JobQueuesLive).pipe(
			Layer.provideMerge(AppLayer),
		),
	);
	afterAll(() => runtime.dispose());

	const run = <A, E>(
		effect: Effect.Effect<
			A,
			E,
			ManagedRuntime.ManagedRuntime.Services<typeof runtime>
		>,
	) => runtime.runPromise(effect);

	/** A user with a real session row whose active organization is set. */
	const signIn = (
		organizationId: OrganizationId,
		userId: UserId,
	): Promise<Actor> =>
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
		const procedures = await run(Procedures);
		const { data, meta } = await run(
			procedures.block.create(
				{
					type: "template",
					name: "Integration block",
					description: null,
					contentJson: null,
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

	/** A PDF asset row owned by `owner`, with its authorization in place. */
	const createAsset = (owner: Actor, organizationId: OrganizationId) =>
		run(
			Effect.gen(function* () {
				const db = yield* DB;
				const { result, zedToken } = yield* writeRelationships(
					{
						organizationIds: [
							organizationId,
						],
					},
					Effect.gen(function* () {
						const [asset] = yield* db
							.insert(dbSchema.asset)
							.values({
								title: "Integration asset",
								size: 1,
								fileType: "pdf",
								bucket: buckets.main.name,
								prefix: `users/${owner.user.id}/asset`,
								userId: owner.user.id,
							})
							.returning();
						yield* initializeResourceAuthorization({
							resource: {
								resourceType: "asset",
								resourceId: asset.id,
							},
							organizationId,
							ownerUserId: owner.user.id,
						});
						return asset;
					}),
				);
				return {
					asset: result,
					zedToken,
				};
			}),
		);

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

	/** An instance admin, signed in to `organizationId` without belonging to it. */
	const instanceAdmin = async (organizationId: OrganizationId) => {
		const user = await run(
			createUser({
				role: INSTANCE_ADMIN_ROLE,
			}),
		);
		return signIn(organizationId, user.id);
	};

	return {
		run,
		signIn,
		procedureOptions,
		organizationWith,
		createBlock,
		createAsset,
		outboxDelivered,
		readTuples,
		instanceAdmin,
	};
};
