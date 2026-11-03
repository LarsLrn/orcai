import type { Job } from "@orcai/pg-boss";
import {
	recoverStaleQuotaReservations,
	STALE_RESERVATION_AGE_MS,
} from "@orcai/quota";
import * as Effect from "effect/Effect";

export const releaseStaleQuotaBatchEffect = (jobs: Job<unknown>[]) =>
	Effect.forEach(
		jobs,
		() =>
			Effect.gen(function* () {
				const { charged, released } = yield* recoverStaleQuotaReservations({
					reservedBefore: new Date(Date.now() - STALE_RESERVATION_AGE_MS),
					limit: 500,
				});

				if (charged + released > 0) {
					yield* Effect.logWarning(
						`quota.recover_stale.completed charged=${charged} released=${released}`,
					);
				}
			}),
		{
			discard: true,
		},
	);
