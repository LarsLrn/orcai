import type {
	OrganizationId,
	ProviderId,
	QuotaPeriodId,
	QuotaPoolId,
	UserId,
} from "@orcai/core";
import type { DB, dbSchema } from "@orcai/db";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import { QuotaCounterStore } from "./counter-store";
import { estimateQuotaReservationAmount } from "./estimator";
import {
	finalizeQuotaLedger,
	releaseQuotaLedger,
	reserveQuotaLedger,
} from "./ledger";
import { resolveQuotaPool } from "./resolver";

interface ReserveQuotaInput {
	organizationId: OrganizationId;
	userId: UserId;
	providerId: ProviderId;
	providerModelId?: string | null;
	appRequestId: string;
	maxExpectedOutputTokens?: number;
	maxExpectedProviderRequests?: number;
	messages: unknown[];
	isFirstTurn: boolean;
}

export interface ReservedQuotaContext {
	reservationKey: string;
	appRequestId: string;
	poolId: QuotaPoolId;
	periodId: QuotaPeriodId;
	providerId: ProviderId;
	providerModelId: string | null;
	meteringMode: (typeof dbSchema.provider.$inferSelect)["meteringMode"];
	reservedAmount: number;
	budgetAmount: number;
	periodEndsAt: Date;
}

interface ReserveQuotaResult {
	allowed: boolean;
	reservation?: ReservedQuotaContext;
	denialReason?: "no_pool" | "exhausted" | "error";
}

export const reserveForAppRequest: (
	input: ReserveQuotaInput,
) => Effect.Effect<ReserveQuotaResult, unknown, QuotaCounterStore | DB> = (
	input,
) =>
	Effect.gen(function* () {
		const resolution = yield* resolveQuotaPool({
			organizationId: input.organizationId,
			userId: input.userId,
			providerId: input.providerId,
			providerModelId: input.providerModelId,
		});

		const winning = resolution.winningPool;
		if (!winning) {
			return {
				allowed: false,
				denialReason: "no_pool",
			} satisfies ReserveQuotaResult;
		}

		const reservationAmount = estimateQuotaReservationAmount({
			meteringMode: winning.meteringMode,
			isFirstTurn: input.isFirstTurn,
			maxExpectedOutputTokens: input.maxExpectedOutputTokens,
			maxExpectedProviderRequests: input.maxExpectedProviderRequests,
			messages: input.messages,
		});

		const reservationKey = `res_${uuidv4()}`;
		const counterStore = yield* QuotaCounterStore;

		const counterReservation = yield* counterStore.reserve({
			poolId: winning.pool.id,
			periodId: winning.period.id,
			reservationKey,
			amount: reservationAmount,
			initialState: {
				remaining: winning.ledger.remainingAmount,
				reserved: winning.ledger.reservedAmount,
				consumed: winning.ledger.consumedAmount,
			},
			meteringMode: winning.meteringMode,
			userId: input.userId,
			organizationId: input.organizationId,
		});

		if (!counterReservation.allowed) {
			return {
				allowed: false,
				denialReason: "exhausted",
			} satisfies ReserveQuotaResult;
		}

		const durableReservation = yield* reserveQuotaLedger({
			organizationId: input.organizationId,
			quotaPoolId: winning.pool.id,
			quotaPeriodId: winning.period.id,
			providerId: winning.pool.providerId,
			providerModelId: winning.pool.providerModelId,
			userId: input.userId,
			appRequestId: input.appRequestId,
			reservationKey,
			meteringMode: winning.meteringMode,
			reservedAmount: reservationAmount,
			metadata: {
				orderedCandidatePoolIds: resolution.orderedCandidatePoolIds,
			},
		}).pipe(
			Effect.catch((error) =>
				counterStore
					.release({
						poolId: winning.pool.id,
						periodId: winning.period.id,
						reservationKey,
					})
					.pipe(
						Effect.catch(() => Effect.void),
						Effect.andThen(Effect.fail(error)),
					),
			),
		);

		if (!durableReservation.inserted) {
			return {
				allowed: true,
				reservation: {
					reservationKey,
					appRequestId: input.appRequestId,
					poolId: winning.pool.id,
					periodId: winning.period.id,
					providerId: winning.pool.providerId,
					providerModelId: winning.pool.providerModelId,
					meteringMode: winning.meteringMode,
					reservedAmount: reservationAmount,
					budgetAmount: winning.ledger.budgetAmount,
					periodEndsAt: winning.period.endsAt,
				},
			} satisfies ReserveQuotaResult;
		}

		return {
			allowed: true,
			reservation: {
				reservationKey,
				appRequestId: input.appRequestId,
				poolId: winning.pool.id,
				periodId: winning.period.id,
				providerId: winning.pool.providerId,
				providerModelId: winning.pool.providerModelId,
				meteringMode: winning.meteringMode,
				reservedAmount: reservationAmount,
				budgetAmount: winning.ledger.budgetAmount,
				periodEndsAt: winning.period.endsAt,
			},
		} satisfies ReserveQuotaResult;
	});

export const finalizeAppRequestQuota: (input: {
	reservation: ReservedQuotaContext;
	actualRequestCount?: number;
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
	providerRequestIds?: string[];
}) => Effect.Effect<void, unknown, QuotaCounterStore | DB> = (input) =>
	Effect.gen(function* () {
		const actualAmount =
			input.reservation.meteringMode === "requests"
				? (input.actualRequestCount ?? 0)
				: (input.totalTokens ?? 0);

		const finalized = yield* finalizeQuotaLedger({
			reservationKey: input.reservation.reservationKey,
			appRequestId: input.reservation.appRequestId,
			actualAmount,
			requestCount: input.actualRequestCount,
			inputTokens: input.inputTokens,
			outputTokens: input.outputTokens,
			totalTokens: input.totalTokens,
			metadata: {
				providerRequestIds: input.providerRequestIds,
			},
		});

		if (!finalized) {
			return;
		}

		const counterStore = yield* QuotaCounterStore;
		yield* counterStore
			.finalize({
				poolId: input.reservation.poolId,
				periodId: input.reservation.periodId,
				reservationKey: input.reservation.reservationKey,
				actualAmount,
			})
			.pipe(
				Effect.catch((error) =>
					Effect.logWarning(
						`quota.finalize.counter_reconcile_required reservationKey=${input.reservation.reservationKey} cause=${String(error)}`,
					),
				),
			);
	});

export const releaseAppRequestQuota: (input: {
	reservation: ReservedQuotaContext;
	reason: "provider_failure" | "app_failure" | "cancelled";
}) => Effect.Effect<void, unknown, QuotaCounterStore | DB> = (input) =>
	Effect.gen(function* () {
		const released = yield* releaseQuotaLedger({
			reservationKey: input.reservation.reservationKey,
			appRequestId: input.reservation.appRequestId,
			reason: input.reason,
			includeFailureEvent: true,
		});

		if (!released) {
			return;
		}

		const counterStore = yield* QuotaCounterStore;
		yield* counterStore
			.release({
				poolId: input.reservation.poolId,
				periodId: input.reservation.periodId,
				reservationKey: input.reservation.reservationKey,
			})
			.pipe(
				Effect.catch((error) =>
					Effect.logWarning(
						`quota.release.counter_reconcile_required reservationKey=${input.reservation.reservationKey} cause=${String(error)}`,
					),
				),
			);
	});
