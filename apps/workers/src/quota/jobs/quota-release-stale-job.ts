import {
	recoverStaleQuotaReservations,
	STALE_RESERVATION_AGE_MS,
} from "@orcai/quota";
import * as Effect from "effect/Effect";

export const releaseStaleQuota = Effect.gen(function* () {
	const { charged, released } = yield* recoverStaleQuotaReservations({
		reservedBefore: new Date(Date.now() - STALE_RESERVATION_AGE_MS),
		limit: 500,
	});

	if (charged + released > 0) {
		yield* Effect.logInfo(
			{
				charged,
				released,
			},
			"Recovered stale quota reservations",
		);
	}
});
