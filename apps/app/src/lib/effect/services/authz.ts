import { PgClient } from "@effect/sql-pg";
import { DB, dbSchema, enumSchema } from "@orcai/db";
import {
	SpiceDbService,
	type TupleMutation,
	writeRelationshipMutations,
} from "@orcai/spice-db";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { recordZedToken } from "@/lib/effect/services/zed-token-mailbox";
import { AuthzError } from "@/lib/effect/utils/errors";
import { AUTHZ } from "@/settings/constants";

const [PENDING, PROCESSED, FAILED, DEAD_LETTER] =
	enumSchema.authzOutboxStatusEnum.enumValues;
// Held for the whole delivery, so one deliverer writes events in seq order.
const DELIVERY_LOCK = 72370905;
const BATCH_SIZE = 200;

const outboxFailure =
	(reason: AuthzError["reason"]) =>
	(cause: unknown): AuthzError =>
		cause instanceof AuthzError
			? cause
			: new AuthzError({
					reason,
					cause,
				});

/**
 * Persists mutations as outbox events of at most `AUTHZ.outboxMutationsPerEvent`
 * each and returns their ids. Joins the caller's transaction; never sends to SpiceDB.
 */
export const enqueueRelationshipMutations = (
	mutations: readonly TupleMutation[],
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* Effect.forEach(
			Arr.chunksOf(mutations, AUTHZ.outboxMutationsPerEvent),
			(chunk) =>
				db
					.insert(dbSchema.authzOutbox)
					.values({
						eventType: "spice.write-relationships",
						payloadJson: {
							mutations: chunk,
						},
						status: PENDING,
					})
					.returning({
						id: dbSchema.authzOutbox.id,
					})
					.pipe(Effect.map(([event]) => event.id)),
		);
	}).pipe(Effect.mapError(outboxFailure("outbox_enqueue_failed")));

type Delivery = {
	zedToken?: string;
};

export class AuthzService extends Context.Service<
	AuthzService,
	{
		readonly applyRelationshipMutations: (params: {
			mutations: TupleMutation[];
		}) => Effect.Effect<Delivery, AuthzError>;
		/**
		 * Delivers committed events, and every older one first, then records the
		 * token of the newest. Returns no token when an older event is failing
		 * or the wait gives up; the outbox loop delivers them later.
		 */
		readonly deliverRelationshipEvents: (
			eventIds: readonly string[],
		) => Effect.Effect<Delivery, AuthzError>;
		readonly replayRelationshipOutbox: () => Effect.Effect<{
			processed: number;
			failed: number;
		}>;
	}
>()("AuthzService") {}

type OutboxEvent = typeof dbSchema.authzOutbox.$inferSelect;

const retryDelayMs = (attempts: number) =>
	Math.min(AUTHZ.outboxRetryBaseDelayMs * 2 ** Math.min(attempts, 4), 600_000);

export const AuthzLive = Layer.effect(
	AuthzService,
	Effect.gen(function* () {
		const db = yield* DB;
		const pg = yield* PgClient.PgClient;
		const spiceDb = yield* SpiceDbService;

		const write = (event: OutboxEvent) =>
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
				return yield* writeRelationshipMutations(mutations).pipe(
					Effect.timeout(AUTHZ.outboxDeliveryTimeoutMs),
					Effect.provideService(SpiceDbService, spiceDb),
				);
			});

		/** Records the outcome of one write: processed, or failed with backoff, or dead-lettered once exhausted. */
		const settle = (event: OutboxEvent) =>
			write(event).pipe(
				Effect.matchEffect({
					onSuccess: ({ zedToken }) =>
						db
							.update(dbSchema.authzOutbox)
							.set({
								status: PROCESSED,
								payloadJson: {
									...event.payloadJson,
									zedToken,
								},
								attempts: event.attempts + 1,
								nextAttemptAt: null,
								updatedAt: new Date(),
							})
							.where(eq(dbSchema.authzOutbox.id, event.id))
							.pipe(Effect.as(PROCESSED)),
					onFailure: (cause) =>
						Effect.gen(function* () {
							const attempts = event.attempts + 1;
							const exhausted = attempts >= AUTHZ.outboxMaxAttempts;
							const now = new Date();
							yield* Effect.logError(
								`authz.${exhausted ? "dead_letter" : "projection_failed"} eventId=${event.id} attempts=${attempts} cause=${String(cause)}`,
							);
							yield* db
								.update(dbSchema.authzOutbox)
								.set({
									status: exhausted ? DEAD_LETTER : FAILED,
									attempts,
									nextAttemptAt: exhausted
										? null
										: new Date(now.getTime() + retryDelayMs(event.attempts)),
									updatedAt: now,
								})
								.where(eq(dbSchema.authzOutbox.id, event.id));
							return exhausted ? DEAD_LETTER : FAILED;
						}),
				}),
			);

		/**
		 * One batch in seq order under the delivery lock, up to `through` when
		 * given. A failing event, or one waiting out its backoff, blocks newer ones.
		 */
		const deliverBatch = (through?: number) =>
			db
				.transaction(() =>
					Effect.gen(function* () {
						const result = {
							locked: false,
							blocked: false,
							more: false,
							processed: 0,
							failed: 0,
						};
						const [{ locked }] = yield* pg<{
							locked: boolean;
						}>`SELECT pg_try_advisory_xact_lock(${DELIVERY_LOCK}) AS locked`;
						if (!locked) return result;
						result.locked = true;
						const events = yield* db
							.select()
							.from(dbSchema.authzOutbox)
							.where(
								and(
									inArray(dbSchema.authzOutbox.status, [
										PENDING,
										FAILED,
									]),
									through === undefined
										? undefined
										: lte(dbSchema.authzOutbox.seq, through),
								),
							)
							.orderBy(asc(dbSchema.authzOutbox.seq))
							.limit(BATCH_SIZE);
						const now = Date.now();
						for (const event of events) {
							if (event.nextAttemptAt && event.nextAttemptAt.getTime() > now) {
								result.blocked = true;
								return result;
							}
							const status = yield* settle(event);
							if (status === PROCESSED) result.processed++;
							else result.failed++;
							if (status === FAILED) {
								result.blocked = true;
								return result;
							}
						}
						result.more = events.length === BATCH_SIZE;
						return result;
					}),
				)
				.pipe(Effect.mapError(outboxFailure("projection_failed")));

		const readNewest = (eventIds: readonly string[]) =>
			db
				.select({
					seq: dbSchema.authzOutbox.seq,
					status: dbSchema.authzOutbox.status,
					payloadJson: dbSchema.authzOutbox.payloadJson,
				})
				.from(dbSchema.authzOutbox)
				.where(
					inArray(dbSchema.authzOutbox.id, [
						...eventIds,
					]),
				)
				.orderBy(asc(dbSchema.authzOutbox.seq))
				.pipe(
					Effect.map((events) => events.at(-1)),
					Effect.mapError(outboxFailure("projection_failed")),
				);

		const deliverRelationshipEvents = (eventIds: readonly string[]) =>
			Effect.gen(function* () {
				if (eventIds.length === 0) return {};
				for (let attempt = 0; ; attempt++) {
					const newest = yield* readNewest(eventIds);
					if (!newest) return {};
					if (newest.status === PROCESSED)
						return {
							zedToken: (
								newest.payloadJson as {
									zedToken?: string;
								}
							).zedToken,
						};
					if (newest.status === DEAD_LETTER) return {};
					const batch = yield* deliverBatch(newest.seq);
					if (batch.blocked) {
						yield* Effect.logWarning(
							`authz.delivery_blocked eventId=${eventIds.at(-1)}`,
						);
						return {};
					}
					if (batch.locked && batch.processed + batch.failed > 0) continue;
					if (attempt >= AUTHZ.outboxInlineWaitAttempts) {
						yield* Effect.logWarning(
							`authz.inline_wait_gave_up eventId=${eventIds.at(-1)}`,
						);
						return {};
					}
					yield* Effect.sleep(AUTHZ.outboxInlineWaitMs);
				}
			}).pipe(
				Effect.tap((delivery: Delivery) => recordZedToken(delivery.zedToken)),
			);

		const applyRelationshipMutations = (params: {
			mutations: TupleMutation[];
		}) =>
			db
				.transaction(() => enqueueRelationshipMutations(params.mutations))
				.pipe(
					Effect.provideService(DB, db),
					Effect.mapError(outboxFailure("outbox_enqueue_failed")),
					Effect.flatMap(deliverRelationshipEvents),
				);

		const replayRelationshipOutbox = () =>
			Effect.gen(function* () {
				let processed = 0;
				let failed = 0;
				for (;;) {
					const batch = yield* deliverBatch();
					processed += batch.processed;
					failed += batch.failed;
					if (!batch.more || batch.blocked)
						return {
							processed,
							failed,
						};
				}
			}).pipe(
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
				replayRelationshipOutbox().pipe(
					Effect.delay("10 seconds"),
					Effect.catchCause((cause) =>
						Effect.logError(`authz.replay_loop_defect cause=${String(cause)}`),
					),
				),
			),
		);
		return {
			applyRelationshipMutations,
			deliverRelationshipEvents,
			replayRelationshipOutbox,
		};
	}),
);
