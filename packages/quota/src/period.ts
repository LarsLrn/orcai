import type { QuotaPoolId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, lte } from "drizzle-orm";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import { type QuotaUnavailableError, unavailable } from "./errors";

type QuotaPeriodState = {
	pool: Pick<
		typeof dbSchema.quotaPool.$inferSelect,
		"periodType" | "budgetAmount" | "isActive"
	>;
	period: typeof dbSchema.quotaPeriod.$inferSelect;
	ledger: typeof dbSchema.quotaLedger.$inferSelect;
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

const openPeriodOf = (quotaPoolId: QuotaPoolId) =>
	and(
		eq(dbSchema.quotaPeriod.quotaPoolId, quotaPoolId),
		eq(dbSchema.quotaPeriod.status, "open"),
	);

/**
 * The pool's current period and its ledger, opened when none is open or the
 * open one has ended. Safe to run concurrently: it holds the pool row until
 * the enclosing transaction ends, so whoever runs it next sees the same
 * period, and a change to the pool waits for it.
 */
export const openQuotaPeriod: (params: {
	quotaPoolId: QuotaPoolId;
}) => Effect.Effect<QuotaPeriodState, QuotaUnavailableError, DB> = (params) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const readOpenPeriod = db
			.select()
			.from(dbSchema.quotaPeriod)
			.where(openPeriodOf(params.quotaPoolId))
			.limit(1);

		return yield* db.transaction(() =>
			Effect.gen(function* () {
				// Usage events keep referencing the pool meanwhile.
				const [pool] = yield* db
					.select({
						periodType: dbSchema.quotaPool.periodType,
						budgetAmount: dbSchema.quotaPool.budgetAmount,
						isActive: dbSchema.quotaPool.isActive,
					})
					.from(dbSchema.quotaPool)
					.where(eq(dbSchema.quotaPool.id, params.quotaPoolId))
					.limit(1)
					.for("no key update");
				if (!pool) {
					return yield* Effect.fail(
						new Error(`Quota pool ${params.quotaPoolId} not found`),
					);
				}
				const now = new Date(yield* Clock.currentTimeMillis);

				let [period] = yield* readOpenPeriod;
				if (!period || now >= period.endsAt) {
					if (period) {
						yield* db
							.update(dbSchema.quotaPeriod)
							.set({
								status: "closed",
								closedAt: now,
							})
							.where(eq(dbSchema.quotaPeriod.id, period.id));
					}
					const bounds = getUtcPeriodBounds({
						at: now,
						periodType: pool.periodType,
					});
					const [created] = yield* db
						.insert(dbSchema.quotaPeriod)
						.values({
							quotaPoolId: params.quotaPoolId,
							startsAt: bounds.start,
							endsAt: bounds.end,
							status: "open",
							createdAt: now,
						})
						.onConflictDoNothing()
						.returning();
					period = created ?? (yield* readOpenPeriod)[0];
				}
				if (!period) {
					return yield* Effect.fail(
						new Error(`Quota pool ${params.quotaPoolId} has no open period`),
					);
				}

				yield* db
					.insert(dbSchema.quotaLedger)
					.values({
						quotaPoolId: params.quotaPoolId,
						quotaPeriodId: period.id,
						budgetAmount: pool.budgetAmount,
						reservedAmount: 0,
						consumedAmount: 0,
						remainingAmount: pool.budgetAmount,
						version: 0,
						updatedAt: now,
					})
					.onConflictDoNothing();
				const [ledger] = yield* db
					.select()
					.from(dbSchema.quotaLedger)
					.where(
						and(
							eq(dbSchema.quotaLedger.quotaPoolId, params.quotaPoolId),
							eq(dbSchema.quotaLedger.quotaPeriodId, period.id),
						),
					)
					.limit(1);

				return {
					pool,
					period,
					ledger,
				};
			}),
		);
	}).pipe(unavailable);

/**
 * Opens the current period of each pool on its own: a pool that fails is
 * logged and left to the next run. Resolves to how many failed.
 */
export const rollOverQuotaPeriods = (poolIds: readonly QuotaPoolId[]) =>
	Effect.forEach(
		poolIds,
		(quotaPoolId) =>
			openQuotaPeriod({
				quotaPoolId,
			}).pipe(
				Effect.as(0),
				Effect.catchCause((cause) =>
					Effect.logError(
						`quota.rollover.failed poolId=${quotaPoolId} ${Cause.pretty(cause)}`,
					).pipe(Effect.as(1)),
				),
			),
		{
			concurrency: 10,
		},
	).pipe(Effect.map((failed) => failed.reduce((sum, n) => sum + n, 0)));

/** The active pools whose open period has ended. */
export const listExpiredOpenQuotaPeriods: (params?: {
	now?: Date;
	limit?: number;
}) => Effect.Effect<QuotaPoolId[], QuotaUnavailableError, DB> = (params) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = params?.now ?? new Date();

		const rows = yield* db
			.select({
				poolId: dbSchema.quotaPeriod.quotaPoolId,
			})
			.from(dbSchema.quotaPeriod)
			.innerJoin(
				dbSchema.quotaPool,
				eq(dbSchema.quotaPool.id, dbSchema.quotaPeriod.quotaPoolId),
			)
			.where(
				and(
					eq(dbSchema.quotaPeriod.status, "open"),
					eq(dbSchema.quotaPool.isActive, true),
					lte(dbSchema.quotaPeriod.endsAt, now),
				),
			)
			.limit(params?.limit ?? 200);
		return rows.map((row) => row.poolId);
	}).pipe(unavailable);
