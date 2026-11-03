import type { Job } from "@orcai/pg-boss";
import {
	listExpiredOpenQuotaPeriods,
	rollOverQuotaPeriods,
} from "@orcai/quota";
import * as Effect from "effect/Effect";

export const rolloverQuotaPeriodBatchEffect = (jobs: Job<unknown>[]) =>
	Effect.forEach(
		jobs,
		() =>
			Effect.gen(function* () {
				const poolIds = yield* listExpiredOpenQuotaPeriods({
					limit: 400,
				});
				const failed = yield* rollOverQuotaPeriods(poolIds);

				yield* Effect.logInfo(
					`quota.rollover.completed expiredPeriods=${poolIds.length} failed=${failed}`,
				);
				// The queue runs it again soon; pools already rolled over stay as they are.
				if (failed > 0) {
					return yield* Effect.fail(
						new Error(`${failed} quota pools could not roll over`),
					);
				}
			}),
		{
			discard: true,
		},
	);
