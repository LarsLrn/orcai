import type { Job } from "@orcai/pg-boss";
import {
	releaseStaleQuotaReservations,
	STALE_RESERVATION_AGE_MS,
} from "@orcai/quota";
import * as Effect from "effect/Effect";

export const releaseStaleQuotaBatchEffect = (jobs: Job<unknown>[]) =>
	Effect.forEach(
		jobs,
		() =>
			Effect.gen(function* () {
				const released = yield* releaseStaleQuotaReservations({
					reservedBefore: new Date(Date.now() - STALE_RESERVATION_AGE_MS),
					limit: 500,
				});

				if (released > 0) {
					yield* Effect.logWarning(
						`quota.release_stale.completed released=${released}`,
					);
				}
			}),
		{
			discard: true,
		},
	);
