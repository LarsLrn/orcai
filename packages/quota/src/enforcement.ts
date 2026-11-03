import type {
	BotId,
	ModelId,
	OrganizationId,
	ProviderId,
	UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { eq } from "drizzle-orm";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import {
	QuotaDeniedError,
	type QuotaUnavailableError,
	type QuotaWriteFailedError,
	unavailable,
	writeFailed,
} from "./errors";
import { reservationAmount } from "./estimator";
import {
	listStaleQuotaReservations,
	type ReleaseReason,
	recordQuotaUsage,
	reserveQuotaLedger,
	settleQuotaReservation,
} from "./ledger";
import { loadPriceList } from "./pricing";
import { resolveQuotaPool } from "./resolver";
import type { MeteredStep } from "./usage";

export type { ReleaseReason } from "./ledger";

export interface ReservedQuota {
	reservationKey: string;
	appRequestId: string;
	providerId: ProviderId;
	modelId: ModelId | null;
	meteringMode: (typeof dbSchema.provider.$inferSelect)["meteringMode"];
	reservedAmount: number;
}

const modelMaxOutputTokens = (modelId: ModelId) =>
	Effect.gen(function* () {
		const [model] = yield* (yield* DB)
			.select({
				maxOutputTokens: dbSchema.model.maxOutputTokens,
			})
			.from(dbSchema.model)
			.where(eq(dbSchema.model.id, modelId))
			.limit(1);
		return model?.maxOutputTokens ?? undefined;
	});

/** Reserves a call's likely use on the first pool that covers the person. */
export const reserveForAppRequest = (input: {
	organizationId: OrganizationId;
	userId: UserId;
	providerId: ProviderId;
	modelId: ModelId | null;
	/** The bot whose chat the call runs in. */
	botId?: BotId | null;
	appRequestId: string;
	/** With requests metering, fewer are reserved when fewer remain. */
	maxRequests: number;
	maxOutputTokens?: number;
	inputTokens: number;
}): Effect.Effect<
	ReservedQuota,
	QuotaDeniedError | QuotaUnavailableError,
	DB
> =>
	Effect.gen(function* () {
		const resolution = yield* resolveQuotaPool({
			organizationId: input.organizationId,
			userId: input.userId,
			providerId: input.providerId,
			modelId: input.modelId,
		});
		const winning = resolution.winningPool;
		if (!winning) {
			return yield* new QuotaDeniedError({
				reason: "QUOTA_POOL_UNAVAILABLE",
				message: "No quota pool covers this request.",
			});
		}

		const amount = reservationAmount({
			meteringMode: winning.meteringMode,
			maxRequests: input.maxRequests,
			inputTokens: input.inputTokens,
			maxOutputTokens:
				input.maxOutputTokens ??
				(winning.meteringMode === "tokens" && input.modelId !== null
					? yield* unavailable(modelMaxOutputTokens(input.modelId))
					: undefined),
		});
		const reservationKey = `res_${uuidv4()}`;
		const reserved = yield* unavailable(
			reserveQuotaLedger({
				organizationId: input.organizationId,
				quotaPoolId: winning.pool.id,
				providerId: winning.pool.providerId,
				modelId: input.modelId,
				botId: input.botId,
				userId: input.userId,
				appRequestId: input.appRequestId,
				reservationKey,
				meteringMode: winning.meteringMode,
				amount,
				// A request-metered call can run with fewer requests; tokens are all or nothing.
				minimumAmount: winning.meteringMode === "requests" ? 1 : amount,
				metadata: {
					orderedCandidatePoolIds: resolution.orderedCandidatePoolIds,
				},
			}),
		);
		if (reserved.status !== "reserved") {
			return yield* reserved.status === "inactive"
				? new QuotaDeniedError({
						reason: "QUOTA_POOL_UNAVAILABLE",
						message: `Quota pool ${winning.pool.id} was deactivated.`,
					})
				: new QuotaDeniedError({
						reason: "QUOTA_EXHAUSTED",
						message: `Quota pool ${winning.pool.id} is used up.`,
					});
		}

		return {
			reservationKey,
			appRequestId: input.appRequestId,
			providerId: winning.pool.providerId,
			modelId: input.modelId,
			meteringMode: winning.meteringMode,
			reservedAmount: reserved.reservedAmount,
		};
	});

/** Stores a call's finished steps so far with its reservation. */
export const recordReservationUsage = (input: {
	reservation: ReservedQuota;
	steps: readonly MeteredStep[];
}): Effect.Effect<void, QuotaWriteFailedError, DB> =>
	recordQuotaUsage({
		reservationKey: input.reservation.reservationKey,
		steps: input.steps,
	}).pipe(
		Effect.flatMap((status) =>
			status === "settled"
				? Effect.logWarning({
						message: "quota.record.after_settle",
						reservationKey: input.reservation.reservationKey,
					})
				: Effect.void,
		),
		writeFailed("The call's usage could not be stored."),
	);

/** The prices in force for a reservation; a call whose prices cannot be read is charged without a cost. */
const pricesOf = (reservation: {
	reservationKey: string;
	providerId: ProviderId;
	modelId: ModelId | null;
}) =>
	loadPriceList(reservation).pipe(
		Effect.catch((error) =>
			Effect.logWarning(
				`quota.settle.prices_unavailable reservationKey=${reservation.reservationKey} cause=${String(error)}`,
			).pipe(Effect.as(null)),
		),
	);

/**
 * Charges a call its steps at the prices now in force, one provider request
 * each, and releases the rest; without steps it releases all of it.
 */
export const settleReservation = (input: {
	reservation: ReservedQuota;
	steps: readonly MeteredStep[];
	reason: ReleaseReason;
}): Effect.Effect<void, QuotaWriteFailedError, DB> =>
	Effect.gen(function* () {
		yield* settleQuotaReservation({
			reservationKey: input.reservation.reservationKey,
			steps: input.steps,
			reason: input.reason,
			prices:
				input.steps.length === 0 ? null : yield* pricesOf(input.reservation),
		});
	}).pipe(writeFailed("The call could not be settled."));

/**
 * Ends the reservations made before `reservedBefore` that never settled, in
 * open and closed periods: one with stored steps is charged them, marked as
 * recovered, one without is released. A reservation that fails is logged and
 * left to the next run.
 */
export const recoverStaleQuotaReservations = (params: {
	reservedBefore: Date;
	limit: number;
}): Effect.Effect<
	{
		charged: number;
		released: number;
	},
	QuotaWriteFailedError,
	DB
> =>
	Effect.gen(function* () {
		const stale = yield* listStaleQuotaReservations(params);
		const settled = yield* Effect.forEach(
			stale,
			(reservation) =>
				Effect.gen(function* () {
					return yield* settleQuotaReservation({
						reservationKey: reservation.reservationKey,
						steps: undefined,
						reason: "expired",
						prices: yield* pricesOf(reservation),
					});
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.logError(
							`quota.recover.failed reservationKey=${reservation.reservationKey} ${Cause.pretty(cause)}`,
						).pipe(Effect.as(null)),
					),
				),
			{
				concurrency: 10,
			},
		);
		const ended = settled.filter((result) => result?.inserted);
		return {
			charged: ended.filter((result) => result?.charged).length,
			released: ended.filter((result) => !result?.charged).length,
		};
	}).pipe(writeFailed("Stale reservations could not be ended."));
