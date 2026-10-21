import { DB, dbSchema } from "@orcai/db";
import type { Job } from "@orcai/pg-boss";
import { QuotaCounterStore, reconcileQuotaLedger } from "@orcai/quota";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";

export const reconcileQuotaBatchEffect = (jobs: Job<unknown>[]) =>
	Effect.forEach(
		jobs,
		() =>
			Effect.gen(function* () {
				const db = yield* DB;
				const counterStore = yield* QuotaCounterStore;

				const openLedgers = yield* db
					.select({
						poolId: dbSchema.quotaLedger.quotaPoolId,
						periodId: dbSchema.quotaLedger.quotaPeriodId,
					})
					.from(dbSchema.quotaLedger)
					.innerJoin(
						dbSchema.quotaPeriod,
						and(
							eq(dbSchema.quotaPeriod.id, dbSchema.quotaLedger.quotaPeriodId),
							eq(dbSchema.quotaPeriod.status, "open"),
						),
					);

				const results = yield* Effect.forEach(
					openLedgers,
					({ poolId, periodId }) =>
						Effect.gen(function* () {
							const reconciled = yield* reconcileQuotaLedger({
								quotaPoolId: poolId,
								quotaPeriodId: periodId,
							});
							if (!reconciled) return false;
							const { before, after } = reconciled;

							const ledgerDrift =
								before.reserved !== after.reserved ||
								before.consumed !== after.consumed ||
								before.remaining !== after.remaining;
							if (ledgerDrift) {
								yield* Effect.logWarning(
									`quota.reconcile.ledger_corrected poolId=${poolId} periodId=${periodId} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
								);
							}

							const counters = yield* counterStore.getState({
								poolId,
								periodId,
							});
							const counterDrift =
								counters.reserved !== after.reserved ||
								counters.consumed !== after.consumed ||
								counters.remaining !== after.remaining;
							if (counterDrift) {
								yield* counterStore.overwriteState({
									poolId,
									periodId,
									...after,
								});
							}

							return ledgerDrift || counterDrift;
						}),
					{
						concurrency: 12,
					},
				);

				yield* Effect.logInfo(
					`quota.reconcile.completed checked=${openLedgers.length} drift=${results.filter(Boolean).length}`,
				);
			}),
		{
			discard: true,
		},
	);
