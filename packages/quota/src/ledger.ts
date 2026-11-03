import type {
	BotId,
	GroupId,
	ModelId,
	OrganizationId,
	ProviderId,
	QuotaPoolId,
	UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, inArray, lt, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import { type QuotaWriteFailedError, writeFailed } from "./errors";
import { openQuotaPeriod } from "./period";
import { type PriceList, priceSteps } from "./pricing";
import { type MeteredStep, usageCounts } from "./usage";

type QuotaPool = typeof dbSchema.quotaPool.$inferSelect;
type QuotaPeriod = typeof dbSchema.quotaPeriod.$inferSelect;
type QuotaLedger = typeof dbSchema.quotaLedger.$inferSelect;
type QuotaUsageEvent = typeof dbSchema.quotaUsageEvent.$inferSelect;

type CreateQuotaPoolWithInitialPeriodResult = {
	pool: QuotaPool;
	period: QuotaPeriod;
	ledger: QuotaLedger;
};

type UpdateQuotaPoolBudgetResult = {
	pool: QuotaPool;
	ledger: QuotaLedger;
	period: QuotaPeriod;
} | null;

type LedgerReserveResult =
	| {
			status: "reserved";
			reservedAmount: number;
			period: QuotaPeriod;
			budgetAmount: number;
	  }
	| {
			status: "exhausted" | "inactive";
	  };

export const createQuotaPoolWithInitialPeriod: (params: {
	organizationId: OrganizationId;
	name: string;
	description?: string | null;
	providerId: ProviderId;
	modelId?: ModelId | null;
	periodType: (typeof dbSchema.quotaPool.$inferInsert)["periodType"];
	budgetAmount: number;
	priority: number;
	isDefault: boolean;
	isActive?: boolean;
	createdByUserId: UserId;
	assignedGroupIds: GroupId[];
}) => Effect.Effect<
	CreateQuotaPoolWithInitialPeriodResult,
	QuotaWriteFailedError,
	DB
> = (params) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = new Date();

		return yield* db.transaction((tx) =>
			Effect.gen(function* () {
				const [pool] = yield* tx
					.insert(dbSchema.quotaPool)
					.values({
						organizationId: params.organizationId,
						name: params.name,
						description: params.description ?? null,
						providerId: params.providerId,
						modelId: params.modelId ?? null,
						periodType: params.periodType,
						budgetAmount: params.budgetAmount,
						priority: params.priority,
						isDefault: params.isDefault,
						isActive: params.isActive ?? true,
						createdByUserId: params.createdByUserId,
						createdAt: now,
						updatedAt: now,
					})
					.returning();

				if (params.assignedGroupIds.length > 0) {
					yield* tx.insert(dbSchema.quotaPoolGroupAssignment).values(
						params.assignedGroupIds.map((groupId) => ({
							quotaPoolId: pool.id,
							groupId,
							isActive: true,
							createdByUserId: params.createdByUserId,
							createdAt: now,
							updatedAt: now,
						})),
					);
				}

				const { period, ledger } = yield* openQuotaPeriod({
					quotaPoolId: pool.id,
				});

				yield* tx.insert(dbSchema.quotaPoolAuditLog).values({
					organizationId: pool.organizationId,
					quotaPoolId: pool.id,
					actorUserId: params.createdByUserId,
					actionType: "pool_created",
					beforeState: null,
					afterState: {
						poolId: pool.id,
						assignedGroupIds: params.assignedGroupIds,
					},
					createdAt: now,
				});

				return {
					pool,
					period,
					ledger,
				};
			}),
		);
	}).pipe(writeFailed("The quota pool could not be created."));

export const updateQuotaPoolBudget: (params: {
	poolId: QuotaPoolId;
	organizationId: OrganizationId;
	newBudgetAmount: number;
	actorUserId: UserId;
	skipAuditLog?: boolean;
}) => Effect.Effect<UpdateQuotaPoolBudgetResult, unknown, DB> = (params) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = new Date();

		return yield* db.transaction((tx) =>
			Effect.gen(function* () {
				// The pool first, as every writer of its periods and ledger takes it.
				const [pool] = yield* tx
					.select()
					.from(dbSchema.quotaPool)
					.where(
						and(
							eq(dbSchema.quotaPool.id, params.poolId),
							eq(dbSchema.quotaPool.organizationId, params.organizationId),
						),
					)
					.limit(1)
					.for("no key update");

				if (!pool) {
					return null;
				}

				const { period, ledger } = yield* openQuotaPeriod({
					quotaPoolId: pool.id,
				});

				const [updatedPool] = yield* tx
					.update(dbSchema.quotaPool)
					.set({
						budgetAmount: params.newBudgetAmount,
						updatedAt: now,
					})
					.where(eq(dbSchema.quotaPool.id, pool.id))
					.returning();

				const [updatedLedger] = yield* tx
					.update(dbSchema.quotaLedger)
					.set({
						budgetAmount: params.newBudgetAmount,
						remainingAmount: sql`greatest(0, ${params.newBudgetAmount} - ${dbSchema.quotaLedger.reservedAmount} - ${dbSchema.quotaLedger.consumedAmount})`,
						version: sql`${dbSchema.quotaLedger.version} + 1`,
						updatedAt: now,
					})
					.where(
						and(
							eq(dbSchema.quotaLedger.quotaPoolId, pool.id),
							eq(dbSchema.quotaLedger.quotaPeriodId, period.id),
						),
					)
					.returning();

				if (!params.skipAuditLog) {
					yield* tx.insert(dbSchema.quotaPoolAuditLog).values({
						organizationId: params.organizationId,
						quotaPoolId: pool.id,
						actorUserId: params.actorUserId,
						actionType: "pool_budget_updated",
						beforeState: {
							budgetAmount: pool.budgetAmount,
							ledgerBudgetAmount: ledger.budgetAmount,
						},
						afterState: {
							budgetAmount: updatedPool.budgetAmount,
							ledgerBudgetAmount: updatedLedger.budgetAmount,
							remainingAmount: updatedLedger.remainingAmount,
						},
						createdAt: now,
					});
				}

				return {
					pool: updatedPool,
					ledger: updatedLedger,
					period,
				};
			}),
		);
	});

/**
 * Reserves on the pool's current period, opened if needed, with the pool and
 * then the ledger row locked; the ledger decides how much is granted.
 */
export const reserveQuotaLedger: (params: {
	organizationId: OrganizationId;
	quotaPoolId: QuotaPoolId;
	providerId: ProviderId;
	modelId?: ModelId | null;
	botId?: BotId | null;
	userId: UserId;
	appRequestId: string;
	reservationKey: string;
	meteringMode: (typeof dbSchema.provider.$inferSelect)["meteringMode"];
	/** The most to reserve; less is granted when less remains. */
	amount: number;
	/** The least worth reserving; below it the reservation is refused. */
	minimumAmount: number;
	metadata?: Record<string, unknown>;
}) => Effect.Effect<LedgerReserveResult, unknown, DB> = (params) =>
	Effect.gen(function* () {
		const db = yield* DB;

		// Waiting for the ledger can outlast the period; the next one opens then, once.
		const reserveOnCurrentPeriod = (
			retried: boolean,
		): Effect.Effect<LedgerReserveResult, unknown, DB> =>
			Effect.gen(function* () {
				const { pool, period } = yield* openQuotaPeriod({
					quotaPoolId: params.quotaPoolId,
				});
				// Deactivated since it was resolved.
				if (!pool.isActive) {
					return {
						status: "inactive",
					} satisfies LedgerReserveResult;
				}
				const ledgerOf = and(
					eq(dbSchema.quotaLedger.quotaPoolId, params.quotaPoolId),
					eq(dbSchema.quotaLedger.quotaPeriodId, period.id),
				);
				const [ledger] = yield* db
					.select()
					.from(dbSchema.quotaLedger)
					.where(ledgerOf)
					.limit(1)
					.for("update");
				const now = new Date(yield* Clock.currentTimeMillis);
				if (now >= period.endsAt) {
					return retried
						? yield* Effect.fail(
								new Error(`Quota pool ${params.quotaPoolId} kept rolling over`),
							)
						: yield* reserveOnCurrentPeriod(true);
				}

				const reservedAmount = Math.min(params.amount, ledger.remainingAmount);
				if (reservedAmount < params.minimumAmount || reservedAmount <= 0) {
					return {
						status: "exhausted",
					} satisfies LedgerReserveResult;
				}

				yield* db.insert(dbSchema.quotaUsageEvent).values({
					organizationId: params.organizationId,
					quotaPoolId: params.quotaPoolId,
					quotaPeriodId: period.id,
					providerId: params.providerId,
					modelId: params.modelId ?? null,
					botId: params.botId ?? null,
					userId: params.userId,
					appRequestId: params.appRequestId,
					eventType: "reserved",
					reservationKey: params.reservationKey,
					meteringMode: params.meteringMode,
					reservedAmount,
					actualAmount: 0,
					metadata: params.metadata,
					occurredAt: now,
					createdAt: now,
				});

				yield* db
					.update(dbSchema.quotaLedger)
					.set({
						reservedAmount: sql`${dbSchema.quotaLedger.reservedAmount} + ${reservedAmount}`,
						remainingAmount: sql`greatest(0, ${dbSchema.quotaLedger.budgetAmount} - (${dbSchema.quotaLedger.reservedAmount} + ${reservedAmount}) - ${dbSchema.quotaLedger.consumedAmount})`,
						version: sql`${dbSchema.quotaLedger.version} + 1`,
						updatedAt: now,
					})
					.where(ledgerOf);

				return {
					status: "reserved",
					reservedAmount,
					period,
					budgetAmount: ledger.budgetAmount,
				} satisfies LedgerReserveResult;
			});

		return yield* db.transaction(() => reserveOnCurrentPeriod(false));
	});

/** Why a reservation was given back without a charge. */
export type ReleaseReason =
	| "provider_failure"
	| "app_failure"
	| "cancelled"
	| "expired";

/** The reservation's own event row, locked: tally writes and settling take it in turn. */
const lockReservation = (reservationKey: string) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const event = dbSchema.quotaUsageEvent;
		const [reserved] = yield* db
			.select()
			.from(event)
			.where(
				and(
					eq(event.reservationKey, reservationKey),
					eq(event.eventType, "reserved"),
				),
			)
			.limit(1)
			.for("update");
		if (!reserved) {
			return undefined;
		}
		const [settled] = yield* db
			.select({
				id: event.id,
			})
			.from(event)
			.where(
				and(
					eq(event.reservationKey, reservationKey),
					inArray(event.eventType, [
						"finalized",
						"released",
					]),
				),
			)
			.limit(1);
		return {
			reserved,
			settled: settled !== undefined,
		};
	});

/** The steps a call stored with its reservation so far. */
const storedSteps = (reserved: QuotaUsageEvent): readonly MeteredStep[] => {
	const steps = reserved.metadata?.steps;
	return Array.isArray(steps) ? (steps as MeteredStep[]) : [];
};

/**
 * Stores a call's steps so far with its reservation, summed into its usage
 * counts. Each write carries every step and only a longer one replaces it, so
 * a repeated write counts nothing twice. Refused once the reservation settled.
 */
export const recordQuotaUsage: (params: {
	reservationKey: string;
	steps: readonly MeteredStep[];
}) => Effect.Effect<"recorded" | "settled" | "missing", unknown, DB> = (
	params,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const event = dbSchema.quotaUsageEvent;

		return yield* db.transaction(() =>
			Effect.gen(function* () {
				const reservation = yield* lockReservation(params.reservationKey);
				if (!reservation) {
					return "missing" as const;
				}
				if (reservation.settled) {
					return "settled" as const;
				}
				yield* db
					.update(event)
					.set({
						...usageCounts(params.steps),
						metadata: {
							...reservation.reserved.metadata,
							steps: params.steps,
						},
					})
					.where(
						and(
							eq(event.id, reservation.reserved.id),
							sql`coalesce(${event.requestCount}, 0) < ${params.steps.length}`,
						),
					);
				return "recorded" as const;
			}),
		);
	});

/**
 * Ends a reservation once: charges its steps, the caller's or else those
 * stored with it, and frees the rest; without steps it releases all of it.
 * Null when there is no such reservation.
 */
export const settleQuotaReservation: (params: {
	reservationKey: string;
	/** What the call reported; the stored steps count when they are more. */
	steps: readonly MeteredStep[] | undefined;
	reason: ReleaseReason;
	prices: PriceList | null;
}) => Effect.Effect<
	{
		inserted: boolean;
		charged: boolean;
	} | null,
	unknown,
	DB
> = (params) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = new Date();

		return yield* db.transaction(() =>
			Effect.gen(function* () {
				const reservation = yield* lockReservation(params.reservationKey);
				if (!reservation) {
					return null;
				}
				const { reserved } = reservation;
				if (reservation.settled) {
					return {
						inserted: false,
						charged: false,
					};
				}
				const stored = storedSteps(reserved);
				const steps =
					params.steps !== undefined && params.steps.length >= stored.length
						? params.steps
						: stored;
				const recovered = steps === stored;
				const charged = steps.length > 0;
				const ledgerOf = and(
					eq(dbSchema.quotaLedger.quotaPoolId, reserved.quotaPoolId),
					eq(dbSchema.quotaLedger.quotaPeriodId, reserved.quotaPeriodId),
				);
				yield* db
					.select({
						id: dbSchema.quotaLedger.id,
					})
					.from(dbSchema.quotaLedger)
					.where(ledgerOf)
					.limit(1)
					.for("update");

				const terminal = {
					organizationId: reserved.organizationId,
					quotaPoolId: reserved.quotaPoolId,
					quotaPeriodId: reserved.quotaPeriodId,
					providerId: reserved.providerId,
					modelId: reserved.modelId,
					botId: reserved.botId,
					userId: reserved.userId,
					appRequestId: reserved.appRequestId,
					reservationKey: reserved.reservationKey,
					meteringMode: reserved.meteringMode,
					reservedAmount: reserved.reservedAmount,
					occurredAt: now,
					createdAt: now,
				};
				const freed = sql`greatest(0, ${dbSchema.quotaLedger.reservedAmount} - ${reserved.reservedAmount})`;

				if (charged) {
					const counts = usageCounts(steps);
					const actualAmount =
						reserved.meteringMode === "requests"
							? steps.length
							: (counts.totalTokens ?? 0);
					yield* db.insert(dbSchema.quotaUsageEvent).values({
						...terminal,
						eventType: "finalized",
						actualAmount,
						...counts,
						...priceSteps(steps, params.prices),
						metadata: recovered
							? {
									recoveredAfterInterruption: true,
								}
							: undefined,
					});
					yield* db
						.update(dbSchema.quotaLedger)
						.set({
							reservedAmount: freed,
							consumedAmount: sql`${dbSchema.quotaLedger.consumedAmount} + ${actualAmount}`,
							remainingAmount: sql`greatest(0, ${dbSchema.quotaLedger.budgetAmount} - ${freed} - (${dbSchema.quotaLedger.consumedAmount} + ${actualAmount}))`,
							version: sql`${dbSchema.quotaLedger.version} + 1`,
							updatedAt: now,
						})
						.where(ledgerOf);
				} else {
					yield* db.insert(dbSchema.quotaUsageEvent).values([
						{
							...terminal,
							eventType: "released",
							actualAmount: 0,
							metadata: {
								reason: params.reason,
							},
						},
						// Only a provider that failed shows as a failure.
						...(params.reason === "provider_failure"
							? [
									{
										...terminal,
										eventType: "failed" as const,
										actualAmount: 0,
										metadata: {
											reason: params.reason,
										},
									},
								]
							: []),
					]);
					yield* db
						.update(dbSchema.quotaLedger)
						.set({
							reservedAmount: freed,
							remainingAmount: sql`greatest(0, ${dbSchema.quotaLedger.budgetAmount} - ${freed} - ${dbSchema.quotaLedger.consumedAmount})`,
							version: sql`${dbSchema.quotaLedger.version} + 1`,
							updatedAt: now,
						})
						.where(ledgerOf);
				}

				return {
					inserted: true,
					charged,
				};
			}),
		);
	});

/**
 * Reservations made before `reservedBefore` that never settled, in open and
 * closed periods alike, as when the process running the call died.
 */
export const listStaleQuotaReservations: (params: {
	reservedBefore: Date;
	limit: number;
}) => Effect.Effect<
	{
		reservationKey: string;
		providerId: ProviderId;
		modelId: ModelId | null;
	}[],
	unknown,
	DB
> = (params) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const event = dbSchema.quotaUsageEvent;
		const settlement = alias(event, "settlement");

		return yield* db
			.select({
				reservationKey: event.reservationKey,
				providerId: event.providerId,
				modelId: event.modelId,
			})
			.from(event)
			.where(
				and(
					eq(event.eventType, "reserved"),
					lt(event.occurredAt, params.reservedBefore),
					notExists(
						db
							.select({
								id: settlement.id,
							})
							.from(settlement)
							.where(
								and(
									eq(settlement.reservationKey, event.reservationKey),
									inArray(settlement.eventType, [
										"finalized",
										"released",
									]),
								),
							),
					),
				),
			)
			.limit(params.limit);
	});
