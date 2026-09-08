import { DB, dbSchema, enumSchema } from "@orcai/db";
import {
	SpiceDbService,
	type TupleMutation,
	writeRelationshipMutations,
} from "@orcai/spice-db";
import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { recordZedToken } from "@/lib/effect/services/zed-token-mailbox";
import { AuthzError } from "@/lib/effect/utils/errors";
import { AUTHZ } from "@/settings/constants";

const [PENDING, PROCESSING, PROCESSED, FAILED, DEAD_LETTER] =
	enumSchema.authzOutboxStatusEnum.enumValues;
// Only the claim step takes the lock, so one projector claims a row.
const lock = sql`SELECT pg_advisory_xact_lock(72370905)`;

/** Persist intent with the business changes. Never sends to SpiceDB. */
export const enqueueRelationshipMutations = (params: {
	tx: Pick<typeof DB.Service, "insert">;
	mutations: TupleMutation[];
}) =>
	Effect.gen(function* () {
		if (params.mutations.length === 0) return undefined;
		const [event] = yield* params.tx
			.insert(dbSchema.authzOutbox)
			.values({
				eventType: "spice.write-relationships",
				payloadJson: {
					mutations: params.mutations,
				},
				status: PENDING,
			})
			.returning({
				id: dbSchema.authzOutbox.id,
			});
		return event.id;
	}).pipe(
		Effect.mapError(
			(cause) =>
				new AuthzError({
					reason: "outbox_enqueue_failed",
					cause,
				}),
		),
	);

type Delivery = {
	zedToken?: string;
};
export class AuthzService extends Context.Service<
	AuthzService,
	{
		readonly applyRelationshipMutations: (params: {
			mutations: TupleMutation[];
		}) => Effect.Effect<Delivery, AuthzError>;
		readonly deliverRelationshipEvent: (
			eventId: string | undefined,
		) => Effect.Effect<Delivery, AuthzError>;
		readonly replayRelationshipOutbox: (params?: {
			limit?: number;
		}) => Effect.Effect<{
			processed: number;
			failed: number;
		}>;
	}
>()("AuthzService") {}

type Outcome = {
	eventId: string;
	attempts: number;
	payloadJson: Record<string, unknown>;
	ok: boolean;
	zedToken?: string;
};

export const AuthzLive = Layer.effect(
	AuthzService,
	Effect.gen(function* () {
		const db = yield* DB;
		const spiceDb = yield* SpiceDbService;
		const claimDueEvents = (params: { limit: number }) =>
			db
				.transaction((tx) =>
					Effect.gen(function* () {
						yield* tx.execute(lock);
						const now = new Date();
						yield* tx
							.update(dbSchema.authzOutbox)
							.set({
								status: PENDING,
								updatedAt: now,
							})
							.where(
								and(
									eq(dbSchema.authzOutbox.status, PROCESSING),
									lt(
										dbSchema.authzOutbox.updatedAt,
										new Date(
											now.getTime() - AUTHZ.outboxProcessingStaleAfterMs,
										),
									),
								),
							);
						const events = yield* tx
							.select()
							.from(dbSchema.authzOutbox)
							.where(
								and(
									inArray(dbSchema.authzOutbox.status, [
										PENDING,
										FAILED,
									]),
									or(
										isNull(dbSchema.authzOutbox.nextAttemptAt),
										lte(dbSchema.authzOutbox.nextAttemptAt, now),
									),
								),
							)
							.orderBy(asc(dbSchema.authzOutbox.seq))
							.limit(params.limit)
							.for("update");
						if (events.length === 0) return events;
						yield* tx
							.update(dbSchema.authzOutbox)
							.set({
								status: PROCESSING,
								updatedAt: now,
							})
							.where(
								inArray(
									dbSchema.authzOutbox.id,
									events.map((event) => event.id),
								),
							);
						return events;
					}),
				)
				.pipe(
					Effect.mapError(
						(cause) =>
							new AuthzError({
								reason: "projection_failed",
								cause,
							}),
					),
				);

		const deliver = (event: {
			id: string;
			attempts: number;
			payloadJson: Record<string, unknown>;
		}) =>
			Effect.gen(function* () {
				const mutations = (
					event.payloadJson as {
						mutations?: TupleMutation[];
					}
				).mutations;
				if (!Array.isArray(mutations) || mutations.length === 0)
					return yield* Effect.fail(
						new Error("Invalid permission outbox payload"),
					);
				return yield* writeRelationshipMutations(
					mutations.map((mutation) => ({
						...mutation,
						operation: mutation.operation ?? "touch",
					})),
				).pipe(Effect.provideService(SpiceDbService, spiceDb));
			}).pipe(
				Effect.map(
					(value): Outcome => ({
						eventId: event.id,
						attempts: event.attempts,
						payloadJson: event.payloadJson,
						ok: true,
						zedToken: value.zedToken,
					}),
				),
				Effect.catch((cause) =>
					Effect.logError(
						`authz.projection_failed eventId=${event.id} cause=${String(cause)}`,
					).pipe(
						Effect.as<Outcome>({
							eventId: event.id,
							attempts: event.attempts,
							payloadJson: event.payloadJson,
							ok: false,
						}),
					),
				),
			);

		const finalize = (outcomes: Outcome[]) =>
			db
				.transaction((tx) =>
					Effect.gen(function* () {
						const now = new Date();
						for (const outcome of outcomes) {
							const attempts = outcome.attempts + 1;
							const exhausted =
								!outcome.ok && attempts >= AUTHZ.outboxMaxAttempts;
							if (exhausted)
								yield* Effect.logError(
									`authz.dead_letter eventId=${outcome.eventId} attempts=${attempts}`,
								);
							yield* tx
								.update(dbSchema.authzOutbox)
								.set({
									status: outcome.ok
										? PROCESSED
										: exhausted
											? DEAD_LETTER
											: FAILED,
									payloadJson: outcome.ok
										? {
												...outcome.payloadJson,
												zedToken: outcome.zedToken,
											}
										: outcome.payloadJson,
									attempts,
									nextAttemptAt:
										outcome.ok || exhausted
											? null
											: new Date(
													now.getTime() +
														Math.min(
															AUTHZ.outboxRetryBaseDelayMs *
																2 ** Math.min(outcome.attempts, 4),
															600_000,
														),
												),
									updatedAt: now,
								})
								.where(eq(dbSchema.authzOutbox.id, outcome.eventId));
						}
					}),
				)
				.pipe(
					Effect.mapError(
						(cause) =>
							new AuthzError({
								reason: "outbox_finalize_failed",
								cause,
							}),
					),
				);

		/** Claim due events, write them to SpiceDB outside transactions, and record the results. */
		const project = (params: { limit: number }) =>
			Effect.gen(function* () {
				const events = yield* claimDueEvents(params);
				const outcomes: Outcome[] = [];
				for (const event of events) outcomes.push(yield* deliver(event));
				if (outcomes.length > 0) yield* finalize(outcomes);
				return {
					processed: outcomes.filter((outcome) => outcome.ok).length,
					failed: outcomes.filter((outcome) => !outcome.ok).length,
					outcomes,
				};
			});

		/** The token of an event a concurrent projector claimed, once it is processed. */
		const awaitDeliveredToken = (
			eventId: string,
			attempt = 0,
		): Effect.Effect<Delivery, AuthzError> =>
			Effect.gen(function* () {
				const [event] = yield* db
					.select({
						status: dbSchema.authzOutbox.status,
						payloadJson: dbSchema.authzOutbox.payloadJson,
					})
					.from(dbSchema.authzOutbox)
					.where(eq(dbSchema.authzOutbox.id, eventId))
					.limit(1)
					.pipe(
						Effect.mapError(
							(cause) =>
								new AuthzError({
									reason: "projection_failed",
									cause,
								}),
						),
					);
				if (!event) return {};
				if (event.status === PROCESSED)
					return {
						zedToken: (
							event.payloadJson as {
								zedToken?: string;
							}
						).zedToken,
					};
				const inFlight =
					event.status === PROCESSING || event.status === PENDING;
				if (inFlight && attempt >= AUTHZ.outboxInlineWaitAttempts) {
					yield* Effect.logWarning(
						`authz.inline_wait_gave_up eventId=${eventId} status=${event.status}`,
					);
					return {};
				}
				if (!inFlight) return {};
				yield* Effect.sleep(AUTHZ.outboxInlineWaitMs);
				return yield* awaitDeliveredToken(eventId, attempt + 1);
			});

		const deliverRelationshipEvent = (eventId: string | undefined) =>
			eventId
				? project({
						limit: 200,
					}).pipe(
						Effect.flatMap(
							({ outcomes }): Effect.Effect<Delivery, AuthzError> => {
								const own = outcomes.find(
									(outcome) => outcome.eventId === eventId,
								);
								return own
									? Effect.succeed({
											zedToken: own.ok ? own.zedToken : undefined,
										})
									: awaitDeliveredToken(eventId);
							},
						),
						Effect.tap((delivery) => recordZedToken(delivery.zedToken)),
					)
				: Effect.succeed({
						zedToken: undefined,
					});
		const applyRelationshipMutations = (params: {
			mutations: TupleMutation[];
		}) =>
			Effect.gen(function* () {
				const eventId = yield* db
					.transaction((tx) =>
						enqueueRelationshipMutations({
							tx,
							mutations: params.mutations,
						}),
					)
					.pipe(
						Effect.mapError((cause) =>
							cause instanceof AuthzError
								? cause
								: new AuthzError({
										reason: "outbox_enqueue_failed",
										cause,
									}),
						),
					);
				return yield* deliverRelationshipEvent(eventId);
			});
		const replayRelationshipOutbox = (params?: { limit?: number }) =>
			project({
				limit: params?.limit ?? 100,
			}).pipe(
				Effect.map(({ processed, failed }) => ({
					processed,
					failed,
				})),
				Effect.catch((cause) =>
					Effect.logError(`authz.replay_failed cause=${String(cause)}`).pipe(
						Effect.as({
							processed: 0,
							failed: 1,
						}),
					),
				),
			);
		yield* Effect.forkDetach(
			Effect.forever(
				replayRelationshipOutbox({
					limit: 200,
				}).pipe(
					Effect.delay("10 seconds"),
					Effect.catchCause((cause) =>
						Effect.logError(`authz.replay_loop_defect cause=${String(cause)}`),
					),
				),
			),
		);
		return {
			applyRelationshipMutations,
			deliverRelationshipEvent,
			replayRelationshipOutbox,
		};
	}),
);
