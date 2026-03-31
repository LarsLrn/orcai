import { DB, dbSchema } from "@orcai/db";
import { and, eq, lte } from "drizzle-orm";
import * as Effect from "effect/Effect";

type QuotaPeriodState = {
	period: typeof dbSchema.quotaPeriod.$inferSelect;
	ledger: typeof dbSchema.quotaLedger.$inferSelect;
};

type ExpiredOpenQuotaPeriod = {
	poolId: string;
	periodId: string;
	periodType: (typeof dbSchema.quotaPool.$inferSelect)["periodType"];
	budgetAmount: number;
};

export const getUtcPeriodBounds = (params: {
	at: Date;
	periodType: (typeof dbSchema.quotaPool.$inferSelect)["periodType"];
}) => {
	const at = params.at;
	const year = at.getUTCFullYear();
	const month = at.getUTCMonth();
	const day = at.getUTCDate();
	const dayOfWeek = at.getUTCDay();

	if (params.periodType === "weekly") {
		const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
		const start = new Date(
			Date.UTC(year, month, day - mondayOffset, 0, 0, 0, 0),
		);
		const end = new Date(start);
		end.setUTCDate(end.getUTCDate() + 7);
		return {
			start,
			end,
		};
	}

	if (params.periodType === "monthly") {
		const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
		const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
		return {
			start,
			end,
		};
	}

	const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
	const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
	return {
		start,
		end,
	};
};

export const ensureOpenQuotaPeriod: (params: {
	quotaPoolId: string;
	periodType: (typeof dbSchema.quotaPool.$inferSelect)["periodType"];
	budgetAmount: number;
	now?: Date;
}) => Effect.Effect<QuotaPeriodState, unknown, DB> = (params) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = params.now ?? new Date();

		const result = yield* db.transaction((tx) =>
			Effect.gen(function* () {
				const currentOpenPeriod = yield* tx.query.quotaPeriod.findFirst({
					where: {
						AND: [
							{
								quotaPoolId: params.quotaPoolId,
							},
							{
								status: "open",
							},
						],
					},
				});

				if (currentOpenPeriod && now < currentOpenPeriod.endsAt) {
					const currentLedger = yield* tx.query.quotaLedger.findFirst({
						where: {
							AND: [
								{
									quotaPoolId: params.quotaPoolId,
								},
								{
									quotaPeriodId: currentOpenPeriod.id,
								},
							],
						},
					});

					if (currentLedger) {
						return {
							period: currentOpenPeriod,
							ledger: currentLedger,
						};
					}

					// Orphaned period without a ledger row (e.g. crash mid-transaction).
					// Recover by creating the missing ledger.
					const [recoveredLedger] = yield* tx
						.insert(dbSchema.quotaLedger)
						.values({
							quotaPoolId: params.quotaPoolId,
							quotaPeriodId: currentOpenPeriod.id,
							budgetAmount: params.budgetAmount,
							reservedAmount: 0,
							consumedAmount: 0,
							remainingAmount: params.budgetAmount,
							version: 0,
							updatedAt: now,
						})
						.onConflictDoNothing()
						.returning();

					if (recoveredLedger) {
						return {
							period: currentOpenPeriod,
							ledger: recoveredLedger,
						};
					}

					// onConflictDoNothing means another transaction inserted first, so we re-read.
					const refetchedLedger = yield* tx.query.quotaLedger.findFirst({
						where: {
							AND: [
								{
									quotaPoolId: params.quotaPoolId,
								},
								{
									quotaPeriodId: currentOpenPeriod.id,
								},
							],
						},
					});

					if (refetchedLedger) {
						return {
							period: currentOpenPeriod,
							ledger: refetchedLedger,
						};
					}
				}

				if (currentOpenPeriod && now >= currentOpenPeriod.endsAt) {
					yield* tx
						.update(dbSchema.quotaPeriod)
						.set({
							status: "closed",
							closedAt: now,
						})
						.where(eq(dbSchema.quotaPeriod.id, currentOpenPeriod.id));
				}

				const bounds = getUtcPeriodBounds({
					at: now,
					periodType: params.periodType,
				});

				const [createdPeriod] = yield* tx
					.insert(dbSchema.quotaPeriod)
					.values({
						quotaPoolId: params.quotaPoolId,
						startsAt: bounds.start,
						endsAt: bounds.end,
						status: "open",
					})
					.returning();

				const [createdLedger] = yield* tx
					.insert(dbSchema.quotaLedger)
					.values({
						quotaPoolId: params.quotaPoolId,
						quotaPeriodId: createdPeriod.id,
						budgetAmount: params.budgetAmount,
						reservedAmount: 0,
						consumedAmount: 0,
						remainingAmount: params.budgetAmount,
						version: 0,
						updatedAt: now,
					})
					.returning();

				return {
					period: createdPeriod,
					ledger: createdLedger,
				};
			}),
		);

		return result;
	});

export const listExpiredOpenQuotaPeriods: (params?: {
	now?: Date;
	limit?: number;
}) => Effect.Effect<ExpiredOpenQuotaPeriod[], unknown, DB> = (params) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = params?.now ?? new Date();

		return yield* db
			.select({
				poolId: dbSchema.quotaPeriod.quotaPoolId,
				periodId: dbSchema.quotaPeriod.id,
				periodType: dbSchema.quotaPool.periodType,
				budgetAmount: dbSchema.quotaPool.budgetAmount,
			})
			.from(dbSchema.quotaPeriod)
			.innerJoin(
				dbSchema.quotaPool,
				and(
					eq(dbSchema.quotaPool.id, dbSchema.quotaPeriod.quotaPoolId),
					eq(dbSchema.quotaPool.isActive, true),
				),
			)
			.where(
				and(
					eq(dbSchema.quotaPeriod.status, "open"),
					eq(dbSchema.quotaPool.isActive, true),
					lte(dbSchema.quotaPeriod.endsAt, now),
				),
			)
			.limit(params?.limit ?? 200);
	});
