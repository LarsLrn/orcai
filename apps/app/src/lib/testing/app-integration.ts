import { v1 } from "@authzed/authzed-node";
import {
	buckets,
	INSTANCE_ADMIN_ROLE,
	ORGANIZATION_ROLES,
	type OrganizationId,
	type OrganizationRole,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { TestClock } from "@orcai/pg-boss";
import { IsolatedPgBossLive } from "@orcai/pg-boss/testing";
import { EmbeddingIndex, type EmbeddingIndexScope } from "@orcai/qdrant";
import { SpiceDbService } from "@orcai/spice-db";
import { headZedToken, zedTokenKeeper } from "@orcai/spice-db/testing";
import {
	awaitLockWaiters,
	createOrganization,
	createUser,
	holdLock,
	integrationRuntime,
	rejection,
} from "@orcai/testing";
import { and, asc, eq, inArray, lte, max, ne, sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as ManagedRuntime from "effect/ManagedRuntime";
import {
	lockOrganization,
	writeRelationships,
} from "@/lib/authz/relationship-write";
import { initializeResourceAuthorization } from "@/lib/authz/resource-lifecycle";
import { AppServices } from "@/lib/effect/app-layer";
import { AuthzLive, AuthzService } from "@/lib/effect/services/authz";
import { insertAllMembersGroup } from "@/lib/organizations/organization-lifecycle";
import { Procedures } from "@/lib/orpc/implementation/procedures";
// Loading the router blocks the event loop for seconds. Loaded with this
// module, it is cached before the runtime opens connections that time out.
import "@/lib/orpc/router";

export const TIMEOUT = 30_000;

const tagOf = (error: unknown) =>
	(
		error as {
			_tag?: string;
		}
	)._tag ?? String(error);

/** "allowed", or the tag of the error `operation` fails with. */
export const outcomeOf = async (operation: Promise<unknown>) => {
	const error = await rejection(operation);
	return error === undefined ? "allowed" : tagOf(error);
};

/**
 * Each role's outcome of `operation`, "allowed" or the tag of the error it
 * fails with, called one role after another, and the allowed calls' responses.
 */
export const outcomesByRole = async <R extends OrganizationRole, A>(
	roles: readonly R[],
	operation: (role: R) => Promise<A>,
) => {
	const outcomes: Partial<Record<R, string>> = {};
	const responses: Partial<Record<R, A>> = {};
	for (const role of roles) {
		await operation(role).then(
			(response) => {
				outcomes[role] = "allowed";
				responses[role] = response;
			},
			(error: unknown) => {
				outcomes[role] = tagOf(error);
			},
		);
	}
	return {
		outcomes,
		responses,
	};
};

export type Actor = {
	user: typeof dbSchema.user.$inferSelect;
	session: typeof dbSchema.session.$inferSelect;
};

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

/** Call options whose procedures run on `index` instead of the instance's embedding index. */
export const onEmbeddingIndex = <
	O extends {
		readonly context: {
			readonly "effect/context": Context.Context<never>;
		};
	},
>(
	options: O,
	index: EmbeddingIndexScope,
): O => ({
	...options,
	context: {
		...options.context,
		"effect/context": Context.add(
			options.context["effect/context"],
			EmbeddingIndex,
			index,
		),
	},
});

/**
 * The app's layers over the stack and a pg-boss of the file's own, built
 * before its first test and disposed after its last, with helpers that create
 * organizations, users and resources and read both stores. With
 * `embeddingIndex`, everything runs on it instead of the instance's.
 */
export const appIntegration = (
	options: {
		readonly embeddingIndex?: EmbeddingIndexScope;
		/** pg-boss's time, for tests that run jobs out of retries. */
		readonly clock?: TestClock;
	} = {},
) => {
	const runtime = integrationRuntime(
		(options.embeddingIndex
			? Layer.succeed(EmbeddingIndex, options.embeddingIndex)
			: Layer.empty
		).pipe(
			Layer.provideMerge(AppServices),
			Layer.provideMerge(
				IsolatedPgBossLive({
					clock: options.clock,
				}),
			),
		),
	);

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

	/**
	 * An organization with fresh users in `roles`, each signed in to it. With
	 * `allMembersGroup`, it has the All Members group the app creates with
	 * every organization.
	 */
	const organizationWith = async (
		roles: readonly OrganizationRole[],
		options: {
			readonly allMembersGroup?: boolean;
		} = {},
	) => {
		const users = await Promise.all(roles.map(() => run(createUser())));
		const created = await run(
			createOrganization({
				members: users.map((user, index) => ({
					userId: user.id,
					role: roles[index],
				})),
			}),
		);
		const organizationId = created.organization.id;
		const allMembers =
			options.allMembersGroup && users[0]
				? await run(
						writeRelationships(
							{
								organizationIds: [
									organizationId,
								],
							},
							insertAllMembersGroup({
								organizationId,
								createdBy: users[0].id,
								now: new Date(),
							}),
						),
					)
				: undefined;
		const actors = await Promise.all(
			users.map((user) => signIn(organizationId, user.id)),
		);
		return {
			organizationId,
			slug: created.organization.slug,
			actors,
			allMembersGroupId: allMembers?.result.id,
			zedToken: allMembers?.zedToken ?? created.zedToken,
		};
	};

	/**
	 * An organization with its All Members group and one signed-in member per
	 * role, keyed by role in `as`, then members in `others` for membership
	 * changes to aim at.
	 */
	const organizationByRole = async (
		others: readonly OrganizationRole[] = [],
	) => {
		const { actors, ...organization } = await organizationWith(
			[
				...ORGANIZATION_ROLES,
				...others,
			],
			{
				allMembersGroup: true,
			},
		);
		return {
			...organization,
			as: Object.fromEntries(
				ORGANIZATION_ROLES.map((role, index) => [
					role,
					actors[index],
				]),
			) as Record<OrganizationRole, Actor>,
			others: actors.slice(ORGANIZATION_ROLES.length),
		};
	};

	const behaviourOf =
		(status: "draft" | "ready") => async (owner: Actor, zedToken?: string) => {
			const procedures = await run(Procedures);
			const { data, meta } = await run(
				procedures.block.create(
					{
						type: "behaviour",
						name: "Integration block",
						description: null,
						contentJson: null,
						status,
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
	const createBlock = behaviourOf("draft");
	/** A published behaviour, which a ready bot needs. */
	const createBehaviour = behaviourOf("ready");

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

	const undeliveredAbout = (id: string) =>
		Effect.gen(function* () {
			const db = yield* DB;
			const events = yield* db
				.select({
					id: dbSchema.authzOutbox.id,
				})
				.from(dbSchema.authzOutbox)
				.where(
					and(
						sql`${dbSchema.authzOutbox.payloadJson}::text LIKE ${`%${id}%`}`,
						ne(dbSchema.authzOutbox.status, "processed"),
					),
				);
			return events.map((event) => event.id);
		});

	/** The oldest undelivered event at or before the newest of `eventIds`. */
	const oldestBlocking = (eventIds: readonly string[]) =>
		Effect.gen(function* () {
			const db = yield* DB;
			const newest = db
				.select({
					seq: max(dbSchema.authzOutbox.seq),
				})
				.from(dbSchema.authzOutbox)
				.where(
					inArray(dbSchema.authzOutbox.id, [
						...eventIds,
					]),
				);
			const [event] = yield* db
				.select({
					seq: dbSchema.authzOutbox.seq,
					status: dbSchema.authzOutbox.status,
					attempts: dbSchema.authzOutbox.attempts,
					nextAttemptAt: dbSchema.authzOutbox.nextAttemptAt,
				})
				.from(dbSchema.authzOutbox)
				.where(
					and(
						ne(dbSchema.authzOutbox.status, "processed"),
						lte(dbSchema.authzOutbox.seq, newest),
					),
				)
				.orderBy(asc(dbSchema.authzOutbox.seq))
				.limit(1);
			return event;
		});

	/**
	 * Delivers every outbox event mentioning `id`, and all older ones, through
	 * the Authz interface. An inline delivery gives up under lock contention and
	 * leaves its events to the outbox loop, which this tier must not wait for.
	 */
	const outboxDelivered = async (id: string) => {
		const deadline = Date.now() + 20_000;
		for (;;) {
			const eventIds = await run(undeliveredAbout(id));
			if (eventIds.length === 0) return;
			if (Date.now() > deadline) {
				const blocking = await run(oldestBlocking(eventIds));
				throw new Error(
					`Timed out delivering ${String(eventIds.length)} outbox events for ${id}; oldest blocking: ${JSON.stringify(blocking)}`,
				);
			}
			await run(
				Effect.gen(function* () {
					yield* (yield* AuthzService).deliverRelationshipEvents(eventIds);
				}),
			);
			await new Promise((resolve) => setTimeout(resolve, 25));
		}
	};

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

	type ProcedureOptions = Awaited<ReturnType<typeof procedureOptions>>;

	/**
	 * Runs procedures as actors at the newest zed token, starting from
	 * `zedToken`: each call keeps the token its procedure returns, and
	 * `observe` keeps one a fixture returns.
	 */
	const caller = (zedToken?: string) => {
		const tokens = zedTokenKeeper(() => run(headZedToken), zedToken);
		const call = async <A>(
			actor: Actor,
			operation: (options: ProcedureOptions) => Effect.Effect<
				A & {
					meta?: {
						zedToken?: string;
					};
				},
				unknown
			>,
		) =>
			tokens.track(
				async () =>
					run(operation(await procedureOptions(actor, tokens.read()))),
				(result) => result.meta?.zedToken,
			);
		return {
			call,
			observe: tokens.observe,
			token: tokens.read,
		};
	};

	/**
	 * Holds the organization's write lock, queues `first` then `second` behind
	 * it, and releases it so Postgres runs them in queue order.
	 */
	const queueBehindOrganizationLock = async (
		organizationId: OrganizationId,
		first: () => Promise<unknown>,
		second: () => Promise<unknown>,
	) => {
		const lock = {
			space: "organizationWrites",
			key: organizationId,
		} as const;
		const release = await run(
			holdLock(
				Effect.gen(function* () {
					yield* (yield* DB).execute(lockOrganization(organizationId));
				}),
			),
		);
		const settle = (operation: () => Promise<unknown>) =>
			Promise.allSettled([
				operation(),
			]).then(([outcome]) => outcome);
		const outcomes = [
			settle(first),
		];
		try {
			await run(awaitLockWaiters(lock, 1));
			outcomes.push(settle(second));
			await run(awaitLockWaiters(lock, 2));
		} finally {
			await run(release);
		}
		for (const outcome of await Promise.all(outcomes)) {
			if (outcome.status === "rejected") throw outcome.reason;
		}
	};

	return {
		run,
		caller,
		queueBehindOrganizationLock,
		signIn,
		procedureOptions,
		organizationWith,
		organizationByRole,
		createBlock,
		createBehaviour,
		createAsset,
		outboxDelivered,
		readTuples,
		instanceAdmin,
	};
};
