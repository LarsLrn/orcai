import type { Job } from "@orcai/pg-boss";
import {
	ensureOpenQuotaPeriod,
	listExpiredOpenQuotaPeriods,
} from "@orcai/quota";
import * as Effect from "effect/Effect";

export const rolloverQuotaPeriodBatchEffect = (jobs: Job<unknown>[]) =>
	Effect.forEach(
		jobs,
		() =>
			Effect.gen(function* () {
				const expiredPeriods = yield* listExpiredOpenQuotaPeriods({
					limit: 400,
				});

				yield* Effect.forEach(
					expiredPeriods,
					(expired) =>
						ensureOpenQuotaPeriod({
							quotaPoolId: expired.poolId,
							periodType: expired.periodType,
							budgetAmount: expired.budgetAmount,
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
