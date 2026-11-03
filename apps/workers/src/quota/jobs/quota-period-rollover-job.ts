import {
	listExpiredOpenQuotaPeriods,
	rollOverQuotaPeriods,
} from "@orcai/quota";
import * as Effect from "effect/Effect";

export const rollOverExpiredQuotaPeriods = Effect.gen(function* () {
	const poolIds = yield* listExpiredOpenQuotaPeriods({
		limit: 400,
	});
	const failed = yield* rollOverQuotaPeriods(poolIds);

	yield* Effect.logInfo(
		{
			expiredPeriods: poolIds.length,
			failed,
		},
		"Rolled over quota periods",
	);
	// The queue runs it again soon; pools already rolled over stay as they are.
	if (failed > 0) {
		return yield* Effect.fail(
			new Error(`${failed} quota pools could not roll over`),
		);
	}
});
