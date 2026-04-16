import { DB, dbSchema } from "@orcai/db";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import type { Job } from "pg-boss";

export const verifyQuotaDailyBatchEffect = (jobs: Job<unknown>[]) =>
	Effect.forEach(
		jobs,
		() =>
			Effect.gen(function* () {
				const db = yield* DB;

				const rows = yield* db
					.select({
						poolId: dbSchema.quotaLedger.quotaPoolId,
						periodId: dbSchema.quotaLedger.quotaPeriodId,
						budgetAmount: dbSchema.quotaLedger.budgetAmount,
						reservedAmount: dbSchema.quotaLedger.reservedAmount,
						consumedAmount: dbSchema.quotaLedger.consumedAmount,
						remainingAmount: dbSchema.quotaLedger.remainingAmount,
					})
					.from(dbSchema.quotaLedger)
					.innerJoin(
						dbSchema.quotaPeriod,
						and(
							eq(dbSchema.quotaPeriod.id, dbSchema.quotaLedger.quotaPeriodId),
							eq(dbSchema.quotaPeriod.status, "open"),
						),
					);

				const mismatches: Array<{
					poolId: string;
					periodId: string;
					expectedReserved: number;
					expectedConsumed: number;
					expectedRemaining: number;
					ledgerReserved: number;
					ledgerConsumed: number;
					ledgerRemaining: number;
				}> = [];

				yield* Effect.forEach(
					rows,
					(row) =>
						Effect.gen(function* () {
							const events = yield* db.query.quotaUsageEvent.findMany({
								where: {
									AND: [
										{
											quotaPoolId: {
												eq: row.poolId,
											},
										},
										{
											quotaPeriodId: {
												eq: row.periodId,
											},
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

							if (
								expectedReserved !== row.reservedAmount ||
								expectedConsumed !== row.consumedAmount ||
								expectedRemaining !== row.remainingAmount
							) {
								mismatches.push({
									poolId: row.poolId,
									periodId: row.periodId,
									expectedReserved,
									expectedConsumed,
									expectedRemaining,
									ledgerReserved: row.reservedAmount,
									ledgerConsumed: row.consumedAmount,
									ledgerRemaining: row.remainingAmount,
								});
							}
						}),
					{
						concurrency: 8,
						discard: true,
					},
				);

				// TODO: Consider adding auto-repair for mismatches by updating the ledger row from the recalculated event totals inside a serializable transaction. Currently drift is never corrected.
				if (mismatches.length > 0) {
					yield* Effect.logWarning(
						`quota.verify.mismatches_found checked=${rows.length} mismatchCount=${mismatches.length} mismatches=${JSON.stringify(mismatches)}`,
					);
				}

				yield* Effect.logInfo(
					`quota.verify.completed checked=${rows.length} mismatch=${mismatches.length}`,
				);
			}),
		{
			discard: true,
		},
	);
