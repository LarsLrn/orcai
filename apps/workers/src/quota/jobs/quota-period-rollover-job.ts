import {
	ensureOpenQuotaPeriod,
	listExpiredOpenQuotaPeriods,
	QuotaCounterStore,
} from "@orcai/quota";
import * as Effect from "effect/Effect";
import type { Job } from "pg-boss";

export const rolloverQuotaPeriodBatchEffect = (jobs: Job<unknown>[]) =>
	Effect.forEach(
		jobs,
		() =>
			Effect.gen(function* () {
				const expiredPeriods = yield* listExpiredOpenQuotaPeriods({
					limit: 400,
				});
				const counterStore = yield* QuotaCounterStore;

				yield* Effect.forEach(
					expiredPeriods,
					(expired) =>
						Effect.gen(function* () {
							const nextPeriod = yield* ensureOpenQuotaPeriod({
								quotaPoolId: expired.poolId,
								periodType: expired.periodType,
								budgetAmount: expired.budgetAmount,
							});

							yield* counterStore.overwriteState({
								poolId: expired.poolId,
								periodId: nextPeriod.period.id,
								reserved: nextPeriod.ledger.reservedAmount,
								consumed: nextPeriod.ledger.consumedAmount,
								remaining: nextPeriod.ledger.remainingAmount,
							});
						}),
					{
						concurrency: 10,
						discard: true,
					},
				);

				yield* Effect.logInfo(
					`quota.rollover.completed expiredPeriods=${expiredPeriods.length}`,
				);
			}),
		{
			discard: true,
		},
	);
