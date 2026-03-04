import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { dbSchema, enumSchema } from "@/db/schema";
import { AuthzError } from "@/lib/effect/utils/errors";
import {
	type TupleMutation,
	writeRelationshipMutations,
} from "@/lib/spice-db/client";
import { AUTHZ } from "@/settings/constants";
import { DB } from "./drizzle";
import { SpiceDbService } from "./spice";

const isTupleMutation = (value: unknown): value is TupleMutation => {
	if (!value || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	return (
		typeof record.resourceType === "string" &&
		typeof record.resourceId === "string" &&
		typeof record.relation === "string" &&
		typeof record.subjectType === "string" &&
		typeof record.subjectId === "string"
	);
};

const decodeTupleMutations = (value: unknown): TupleMutation[] => {
	if (!Array.isArray(value)) return [];
	return value.filter(isTupleMutation);
};

/**
 * Computes the delay before the next outbox retry attempt using capped
 * exponential backoff: `base * 2^min(attempts, 4)`, capped at 10 minutes.
 *
 * @param attempts - Number of attempts already made for this event.
 */
const nextRetryDelayMs = (attempts: number): number =>
	Math.min(
		AUTHZ.outboxRetryBaseDelayMs * 2 ** Math.min(attempts, 4),
		10 * 60_000,
	);

const [OUTBOX_PENDING, OUTBOX_PROCESSING, OUTBOX_PROCESSED, OUTBOX_FAILED] =
	enumSchema.authzOutboxStatusEnum.enumValues;

/**
 * AuthzService owns durable relationship writes:
 * it persists mutation intents to Postgres and projects them to SpiceDB.
 *
 * SpiceDbService remains the low-level Spice client used by this service.
 */
export class AuthzService extends Context.Tag("AuthzService")<
	AuthzService,
	{
		/**
		 * Durably applies a batch of SpiceDB relationship mutations.
		 *
		 * Persists the mutations to the `authzOutbox` table before attempting
		 * the SpiceDB write. If the write succeeds the outbox row is marked
		 * `processed` and the resulting `zedToken` is returned. If SpiceDB is
		 * unavailable the row is left in `failed` state for the background
		 * replay worker to retry.
		 *
		 * @param params.mutations - Ordered list of tuple mutations to apply.
		 */
		readonly applyRelationshipMutations: (params: {
			mutations: TupleMutation[];
		}) => Effect.Effect<
			{
				zedToken?: string;
			},
			AuthzError,
			never
		>;
		/**
		 * Replays undelivered outbox events to SpiceDB.
		 *
		 * Picks up rows in `pending` or `failed` state (and stale `processing`
		 * rows from crashed workers) in sequence-order, re-attempts the SpiceDB
		 * write for each, and updates the row status accordingly. Uses
		 * `SELECT FOR UPDATE SKIP LOCKED` so concurrent workers never
		 * double-process the same event.
		 *
		 * Runs automatically as a background daemon every 10 seconds.
		 *
		 * @param params.limit - Maximum events to process per invocation (default 100).
		 */
		readonly replayRelationshipOutbox: (params?: {
			limit?: number;
		}) => Effect.Effect<
			{
				processed: number;
				failed: number;
			},
			never,
			never
		>;
	}
>() {}

export const AuthzLive = Layer.effect(
	AuthzService,
	Effect.gen(function* () {
		const db = yield* DB;
		const spiceDb = yield* SpiceDbService;

		const applyRelationshipMutations = (params: {
			mutations: TupleMutation[];
		}) =>
			Effect.gen(function* () {
				if (params.mutations.length === 0) {
					return {
						zedToken: undefined,
					};
				}

				const now = new Date();
				const [event] = yield* db
					.insert(dbSchema.authzOutbox)
					.values({
						eventType: "spice.write-relationships",
						payloadJson: {
							mutations: params.mutations,
						},
						status: OUTBOX_PROCESSING,
						createdAt: now,
						updatedAt: now,
					})
					.returning({
						id: dbSchema.authzOutbox.id,
					})
					.pipe(
						Effect.mapError(
							(cause) =>
								new AuthzError({
									reason: "outbox_enqueue_failed",
									cause,
								}),
						),
					);

				const projection = yield* writeRelationshipMutations(
					params.mutations,
				).pipe(
					Effect.provideService(SpiceDbService, spiceDb),
					Effect.catchAll((cause) =>
						db
							.update(dbSchema.authzOutbox)
							.set({
								status: OUTBOX_FAILED,
								attempts: 1,
								nextAttemptAt: new Date(
									Date.now() + AUTHZ.outboxRetryBaseDelayMs,
								),
								updatedAt: new Date(),
							})
							.where(eq(dbSchema.authzOutbox.id, event.id))
							.pipe(
								Effect.catchAll(() => Effect.void),
								Effect.zipRight(
									Effect.logError(
										`authz.projection_failed eventId=${event.id} cause=${String(cause)}`,
									),
								),
								Effect.zipRight(
									Effect.fail(
										new AuthzError({
											reason: "projection_failed",
											eventId: event.id,
											cause,
										}),
									),
								),
							),
					),
				);

				yield* db
					.update(dbSchema.authzOutbox)
					.set({
						status: OUTBOX_PROCESSED,
						attempts: 1,
						nextAttemptAt: null,
						updatedAt: new Date(),
					})
					.where(eq(dbSchema.authzOutbox.id, event.id))
					.pipe(
						Effect.mapError(
							(cause) =>
								new AuthzError({
									reason: "outbox_finalize_failed",
									eventId: event.id,
									cause,
								}),
						),
					);

				return {
					zedToken: projection.zedToken,
				};
			}).pipe(
				Effect.catchAll((error) =>
					Effect.logError(
						`authz.outbox_enqueue_failed reason=${error.reason} eventId=${error.eventId ?? "n/a"} cause=${String(error.cause)}`,
					).pipe(Effect.zipRight(Effect.fail(error))),
				),
			);

		const replayRelationshipOutbox = (params?: { limit?: number }) =>
			Effect.gen(function* () {
				const limit = params?.limit ?? 100;
				const now = new Date();
				const staleProcessingCutoff = new Date(
					now.getTime() - AUTHZ.outboxProcessingStaleAfterMs,
				);
				const pending = yield* db.transaction((tx) =>
					Effect.gen(function* () {
						const selected = yield* tx
							.select({
								id: dbSchema.authzOutbox.id,
								seq: dbSchema.authzOutbox.seq,
								payloadJson: dbSchema.authzOutbox.payloadJson,
								attempts: dbSchema.authzOutbox.attempts,
							})
							.from(dbSchema.authzOutbox)
							.where(
								or(
									and(
										inArray(dbSchema.authzOutbox.status, [
											OUTBOX_PENDING,
											OUTBOX_FAILED,
										]),
										or(
											isNull(dbSchema.authzOutbox.nextAttemptAt),
											lte(dbSchema.authzOutbox.nextAttemptAt, now),
										),
									),
									and(
										eq(dbSchema.authzOutbox.status, OUTBOX_PROCESSING),
										lte(dbSchema.authzOutbox.updatedAt, staleProcessingCutoff),
									),
								),
							)
							.orderBy(asc(dbSchema.authzOutbox.seq))
							.limit(limit)
							.for("update", {
								skipLocked: true,
							});

						if (selected.length === 0) {
							return [];
						}

						yield* tx
							.update(dbSchema.authzOutbox)
							.set({
								status: OUTBOX_PROCESSING,
								updatedAt: now,
							})
							.where(
								inArray(
									dbSchema.authzOutbox.id,
									selected.map((event) => event.id),
								),
							);

						return selected;
					}),
				);

				let processed = 0;
				let failed = 0;

				for (const event of pending) {
					const mutations = decodeTupleMutations(
						(event.payloadJson as Record<string, unknown>)?.mutations,
					);
					if (mutations.length === 0) {
						failed += 1;
						yield* db
							.update(dbSchema.authzOutbox)
							.set({
								status: OUTBOX_FAILED,
								attempts: event.attempts + 1,
								nextAttemptAt: new Date(
									Date.now() + nextRetryDelayMs(event.attempts + 1),
								),
								updatedAt: new Date(),
							})
							.where(eq(dbSchema.authzOutbox.id, event.id));
						yield* Effect.logWarning(
							`authz.replay.invalid_payload eventId=${event.id}`,
						);
						continue;
					}

					const projected = yield* writeRelationshipMutations(mutations).pipe(
						Effect.provideService(SpiceDbService, spiceDb),
						Effect.as(true),
						Effect.catchAll((cause) =>
							Effect.logWarning(
								`authz.replay.projection_failed eventId=${event.id} cause=${String(cause)}`,
							).pipe(Effect.as(false)),
						),
					);

					if (projected) {
						processed += 1;
						yield* db
							.update(dbSchema.authzOutbox)
							.set({
								status: OUTBOX_PROCESSED,
								nextAttemptAt: null,
								updatedAt: new Date(),
							})
							.where(eq(dbSchema.authzOutbox.id, event.id));
					} else {
						failed += 1;
						yield* db
							.update(dbSchema.authzOutbox)
							.set({
								status: OUTBOX_FAILED,
								attempts: event.attempts + 1,
								nextAttemptAt: new Date(
									Date.now() + nextRetryDelayMs(event.attempts + 1),
								),
								updatedAt: new Date(),
							})
							.where(eq(dbSchema.authzOutbox.id, event.id));
					}
				}

				const oldestPending = yield* db.query.authzOutbox.findFirst({
					columns: {
						createdAt: true,
					},
					where: {
						status: {
							in: [
								OUTBOX_PENDING,
								OUTBOX_FAILED,
								OUTBOX_PROCESSING,
							],
						},
					},
					orderBy: {
						seq: "asc",
					},
				});

				const oldestPendingAgeMs = oldestPending?.createdAt
					? Date.now() - oldestPending.createdAt.getTime()
					: 0;

				yield* Effect.logDebug(
					`authz.replay.summary processed=${processed} failed=${failed} oldestPendingAgeMs=${oldestPendingAgeMs}`,
				);

				return {
					processed,
					failed,
				};
			}).pipe(
				Effect.catchAll(() =>
					Effect.succeed({
						processed: 0,
						failed: 0,
					}),
				),
			);

		yield* Effect.forkDaemon(
			Effect.forever(
				replayRelationshipOutbox({
					limit: 200,
				}).pipe(Effect.delay("10 seconds")),
			),
		);

		return {
			applyRelationshipMutations,
			replayRelationshipOutbox,
		};
	}),
);
