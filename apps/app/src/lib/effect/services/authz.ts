import { DB, dbSchema, enumSchema } from "@orcai/db";
import {
	grpcStatusOf,
	SpiceDbError,
	SpiceDbService,
	type TupleMutation,
	writeRelationshipMutations,
} from "@orcai/spice-db";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import * as Arr from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { z } from "zod";
import { recordZedToken } from "@/lib/authz/zed-token";
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

const outboxPayloadSchema = z.object({
	mutations: z
		.array(
			z.object({
				resourceType: z.string(),
				resourceId: z.string(),
				relation: z.string(),
				subjectType: z.string(),
				subjectId: z.string(),
				subjectRelation: z.string().optional(),
				operation: z
					.enum([
						"create",
						"delete",
						"touch",
					])
					.optional(),
			}),
		)
		.min(1),
});

const describeFailure = (cause: unknown) =>
	cause instanceof SpiceDbError
		? `code=${grpcStatusOf(cause) ?? "none"} cause=${String(cause.cause)}`
		: `code=none cause=${String(cause)}`;

/** Leaves a row alone once an operator has moved it, for example to `dead_letter`. */
const undelivered = (event: OutboxEvent) =>
	and(
		eq(dbSchema.authzOutbox.id, event.id),
		inArray(dbSchema.authzOutbox.status, [
			PENDING,
			FAILED,
		]),
	);

const retryDelayMs = (attempts: number) =>
	Math.min(AUTHZ.outboxRetryBaseDelayMs * 2 ** Math.min(attempts, 4), 600_000);

export const AuthzLive = Layer.effect(
	AuthzService,
	Effect.gen(function* () {
		const db = yield* DB;
		const spiceDb = yield* SpiceDbService;

		/**
		 * Records the outcome of one delivery attempt. An unreadable payload is
		 * dead-lettered; any other failure retries with backoff until it succeeds.
		 */
		const settle = (event: OutboxEvent) =>
			Effect.gen(function* () {
				const now = new Date(yield* Clock.currentTimeMillis);
				const attempts = event.attempts + 1;
				const payload = outboxPayloadSchema.safeParse(event.payloadJson);
				if (!payload.success) {
					yield* Effect.logError(
						`authz.dead_letter eventId=${event.id} seq=${event.seq} cause=unreadable payload`,
					);
					yield* db
						.update(dbSchema.authzOutbox)
						.set({
							status: DEAD_LETTER,
							attempts,
							nextAttemptAt: null,
							updatedAt: now,
						})
						.where(undelivered(event));
					return DEAD_LETTER;
				}
				return yield* writeRelationshipMutations(
					payload.data.mutations as TupleMutation[],
				).pipe(
					Effect.timeout(AUTHZ.outboxDeliveryTimeoutMs),
					Effect.provideService(SpiceDbService, spiceDb),
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
									attempts,
									nextAttemptAt: null,
									updatedAt: now,
								})
								.where(undelivered(event))
								.pipe(Effect.as(PROCESSED)),
						onFailure: (cause) =>
							Effect.gen(function* () {
								const ageMs = now.getTime() - event.createdAt.getTime();
								yield* Effect.logWithLevel(
									ageMs >= AUTHZ.outboxBlockedErrorAfterMs ? "Error" : "Warn",
								)(
									`authz.delivery_blocked eventId=${event.id} seq=${event.seq} attempts=${attempts} ageSeconds=${Math.round(ageMs / 1000)} ${describeFailure(cause)}`,
								);
								yield* db
									.update(dbSchema.authzOutbox)
									.set({
										status: FAILED,
										attempts,
										nextAttemptAt: new Date(
											now.getTime() + retryDelayMs(event.attempts),
										),
										updatedAt: now,
									})
									.where(undelivered(event));
								return FAILED;
							}),
					}),
				);
			});

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
						const [{ locked }] = yield* db.execute<{
							locked: boolean;
						}>(
							sql`SELECT pg_try_advisory_xact_lock(${DELIVERY_LOCK}) AS locked`,
							"objects",
						);
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
						const now = yield* Clock.currentTimeMillis;
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
					if (batch.blocked) return {};
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

		yield* Effect.forkScoped(
			Effect.forever(
				replayRelationshipOutbox().pipe(
					Effect.delay("10 seconds"),
					Effect.catchDefect((defect) =>
						Effect.logError(`authz.replay_loop_defect cause=${String(defect)}`),
					),
				),
			),
		);
		return {
			deliverRelationshipEvents,
			replayRelationshipOutbox,
		};
	}),
);
