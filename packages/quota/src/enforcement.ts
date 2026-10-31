import type {
	BotId,
	ModelId,
	OrganizationId,
	ProviderId,
	QuotaPeriodId,
	QuotaPoolId,
	UserId,
} from "@orcai/core";
import type { DB, dbSchema } from "@orcai/db";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import { estimateQuotaReservationAmount } from "./estimator";
import {
	finalizeQuotaLedger,
	releaseQuotaLedger,
	reserveQuotaLedger,
} from "./ledger";
import { loadPriceList, priceSteps } from "./pricing";
import { resolveQuotaPool } from "./resolver";
import { type MeteredStep, usageCounts } from "./usage";

interface ReserveQuotaInput {
	organizationId: OrganizationId;
	userId: UserId;
	providerId: ProviderId;
	modelId?: ModelId | null;
	/** The bot whose chat the call runs in. */
	botId?: BotId | null;
	appRequestId: string;
	maxExpectedOutputTokens?: number;
	/** With requests metering, fewer are reserved when fewer remain. */
	maxExpectedProviderRequests: number;
	messages: unknown[];
}

export interface ReservedQuotaContext {
	reservationKey: string;
	appRequestId: string;
	poolId: QuotaPoolId;
	periodId: QuotaPeriodId;
	providerId: ProviderId;
	modelId: ModelId | null;
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
) => Effect.Effect<ReserveQuotaResult, unknown, DB> = (input) =>
	Effect.gen(function* () {
		const resolution = yield* resolveQuotaPool({
			organizationId: input.organizationId,
			userId: input.userId,
			providerId: input.providerId,
			modelId: input.modelId,
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
			maxExpectedOutputTokens: input.maxExpectedOutputTokens,
			maxExpectedProviderRequests: input.maxExpectedProviderRequests,
			messages: input.messages,
		});

		const reservationKey = `res_${uuidv4()}`;
		const reserved = yield* reserveQuotaLedger({
			organizationId: input.organizationId,
			quotaPoolId: winning.pool.id,
			quotaPeriodId: winning.period.id,
			providerId: winning.pool.providerId,
			modelId: input.modelId,
			botId: input.botId,
			userId: input.userId,
			appRequestId: input.appRequestId,
			reservationKey,
			meteringMode: winning.meteringMode,
			amount: reservationAmount,
			// A request-metered call can run with fewer requests; tokens are all or nothing.
			minimumAmount:
				winning.meteringMode === "requests" ? 1 : reservationAmount,
			metadata: {
				orderedCandidatePoolIds: resolution.orderedCandidatePoolIds,
			},
		});

		if (reserved.status !== "reserved") {
			return {
				allowed: false,
				denialReason: reserved.status === "exhausted" ? "exhausted" : "error",
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
				modelId: input.modelId ?? null,
				meteringMode: winning.meteringMode,
				reservedAmount: reserved.reservedAmount,
				budgetAmount: winning.ledger.budgetAmount,
				periodEndsAt: winning.period.endsAt,
			},
		} satisfies ReserveQuotaResult;
	});

/** Charges a call its steps, one provider request each, priced at the prices now in force. */
export const finalizeAppRequestQuota: (input: {
	reservation: ReservedQuotaContext;
	steps: readonly MeteredStep[];
}) => Effect.Effect<void, unknown, DB> = (input) =>
	Effect.gen(function* () {
		const counts = usageCounts(input.steps);
		const actualAmount =
			input.reservation.meteringMode === "requests"
				? input.steps.length
				: (counts.totalTokens ?? 0);
		// A call whose prices cannot be read is still charged, without a cost.
		const prices = yield* loadPriceList({
			providerId: input.reservation.providerId,
			modelId: input.reservation.modelId,
		}).pipe(
			Effect.catch((error) =>
				Effect.logWarning(
					`quota.finalize.prices_unavailable reservationKey=${input.reservation.reservationKey} cause=${String(error)}`,
				).pipe(Effect.as(null)),
			),
		);

		yield* finalizeQuotaLedger({
			reservationKey: input.reservation.reservationKey,
			appRequestId: input.reservation.appRequestId,
			actualAmount,
			usage: {
				...counts,
				...priceSteps(input.steps, prices),
			},
		});
	});

export const releaseAppRequestQuota: (input: {
	reservation: ReservedQuotaContext;
	reason: "provider_failure" | "app_failure" | "cancelled";
}) => Effect.Effect<void, unknown, DB> = (input) =>
	Effect.gen(function* () {
		yield* releaseQuotaLedger({
			reservationKey: input.reservation.reservationKey,
			appRequestId: input.reservation.appRequestId,
			reason: input.reason,
			includeFailureEvent: true,
		});
	});
