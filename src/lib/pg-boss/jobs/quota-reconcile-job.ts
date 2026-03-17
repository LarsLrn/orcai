import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import type { Job } from "pg-boss";
import { dbSchema } from "@/db/schema";
import { DB } from "@/lib/effect/services/drizzle";
import { QuotaCounterStore } from "@/lib/quota/counter-store";

export const reconcileQuotaBatchEffect = (jobs: Job<unknown>[]) =>
	Effect.forEach(
		jobs,
		() =>
			Effect.gen(function* () {
				const db = yield* DB;
				const counterStore = yield* QuotaCounterStore;

				const openRows = yield* db
					.select({
						poolId: dbSchema.quotaPeriod.quotaPoolId,
						periodId: dbSchema.quotaPeriod.id,
						budgetAmount: dbSchema.quotaLedger.budgetAmount,
						reservedAmount: dbSchema.quotaLedger.reservedAmount,
						consumedAmount: dbSchema.quotaLedger.consumedAmount,
						remainingAmount: dbSchema.quotaLedger.remainingAmount,
					})
					.from(dbSchema.quotaPeriod)
					.innerJoin(
						dbSchema.quotaLedger,
						and(
							eq(
								dbSchema.quotaLedger.quotaPoolId,
								dbSchema.quotaPeriod.quotaPoolId,
							),
							eq(dbSchema.quotaLedger.quotaPeriodId, dbSchema.quotaPeriod.id),
						),
					)
					.where(eq(dbSchema.quotaPeriod.status, "open"));

				const results = yield* Effect.forEach(
					openRows,
					(row) =>
						Effect.gen(function* () {
							// Recalculate expected state from events (source of truth)
							const events = yield* db.query.quotaUsageEvent.findMany({
								where: {
									AND: [
										{
											quotaPoolId: row.poolId,
										},
										{
											quotaPeriodId: row.periodId,
										},
									],
								},
							});

							const reservedGross = events
								.filter((event) => event.eventType === "reserved")
								.reduce((sum, event) => sum + event.reservedAmount, 0);
							const reservedReleased = events
								.filter(
									(event) =>
										event.eventType === "finalized" ||
										event.eventType === "released",
								)
								.reduce((sum, event) => sum + event.reservedAmount, 0);
							const expectedReserved = Math.max(
								0,
								reservedGross - reservedReleased,
							);
							const expectedConsumed = events
								.filter((event) => event.eventType === "finalized")
								.reduce((sum, event) => sum + event.actualAmount, 0);
							const expectedRemaining = Math.max(
								0,
								row.budgetAmount - expectedReserved - expectedConsumed,
							);

							const ledgerDrift =
								expectedReserved !== row.reservedAmount ||
								expectedConsumed !== row.consumedAmount ||
								expectedRemaining !== row.remainingAmount;

							// Fix Postgres ledger if it drifted from events
							if (ledgerDrift) {
								yield* db
									.update(dbSchema.quotaLedger)
									.set({
										reservedAmount: expectedReserved,
										consumedAmount: expectedConsumed,
										remainingAmount: expectedRemaining,
										updatedAt: new Date(),
									})
									.where(
										and(
											eq(dbSchema.quotaLedger.quotaPoolId, row.poolId),
											eq(dbSchema.quotaLedger.quotaPeriodId, row.periodId),
										),
									);
							}

							// Sync Redis to the (possibly corrected) expected state
							const redisState = yield* counterStore.getState({
								poolId: row.poolId,
								periodId: row.periodId,
							});

							const redisDrift =
								redisState.remaining !== expectedRemaining ||
								redisState.reserved !== expectedReserved ||
								redisState.consumed !== expectedConsumed;

							if (redisDrift) {
								yield* counterStore.overwriteState({
									poolId: row.poolId,
									periodId: row.periodId,
									remaining: expectedRemaining,
									reserved: expectedReserved,
									consumed: expectedConsumed,
								});
							}

							return ledgerDrift || redisDrift;
						}),
					{
						concurrency: 12,
					},
				);

				const driftCount = results.filter(Boolean).length;

				yield* Effect.logInfo(
					`quota.reconcile.completed checked=${openRows.length} drift=${driftCount}`,
				);
			}),
		{
			discard: true,
		},
	);
