import type {
	BotId,
	GroupId,
	OrganizationId,
	ProviderId,
	QuotaPeriodId,
	QuotaPoolId,
	UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, inArray, lt, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import * as Effect from "effect/Effect";
import { getUtcPeriodBounds } from "./period";
import type { EventCost } from "./pricing";
import type { UsageCounts } from "./usage";

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
	  }
	| {
			status: "exhausted" | "no_ledger";
	  };

type LedgerTransitionResult = {
	inserted: boolean;
	reserved: QuotaUsageEvent;
} | null;

export const createQuotaPoolWithInitialPeriod: (params: {
	organizationId: OrganizationId;
	name: string;
	description?: string | null;
	providerId: ProviderId;
	modelId?: string | null;
	periodType: (typeof dbSchema.quotaPool.$inferInsert)["periodType"];
	budgetAmount: number;
	priority: number;
	isDefault: boolean;
	isActive?: boolean;
	createdByUserId: UserId;
	assignedGroupIds: GroupId[];
}) => Effect.Effect<CreateQuotaPoolWithInitialPeriodResult, unknown, DB> = (
	params,
) =>
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

				const bounds = getUtcPeriodBounds({
					at: now,
					periodType: pool.periodType,
				});

				const [period] = yield* tx
					.insert(dbSchema.quotaPeriod)
					.values({
						quotaPoolId: pool.id,
						startsAt: bounds.start,
						endsAt: bounds.end,
						status: "open",
						createdAt: now,
					})
					.returning();

				const [ledger] = yield* tx
					.insert(dbSchema.quotaLedger)
					.values({
						quotaPoolId: pool.id,
						quotaPeriodId: period.id,
						budgetAmount: pool.budgetAmount,
						reservedAmount: 0,
						consumedAmount: 0,
						remainingAmount: pool.budgetAmount,
						version: 0,
						updatedAt: now,
					})
					.returning();

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
	});

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
				const [pool] = yield* tx
					.select()
					.from(dbSchema.quotaPool)
					.where(
						and(
							eq(dbSchema.quotaPool.id, params.poolId),
							eq(dbSchema.quotaPool.organizationId, params.organizationId),
						),
					)
					.limit(1);

				if (!pool) {
					return null;
				}

				let period = yield* tx.query.quotaPeriod.findFirst({
					where: {
						AND: [
							{
								quotaPoolId: {
									eq: params.poolId,
								},
							},
							{
								status: "open",
							},
						],
					},
				});

				if (!period || now >= period.endsAt) {
					if (period) {
						yield* tx
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
					const [createdPeriod] = yield* tx
						.insert(dbSchema.quotaPeriod)
						.values({
							quotaPoolId: pool.id,
							startsAt: bounds.start,
							endsAt: bounds.end,
							status: "open",
							createdAt: now,
						})
						.onConflictDoNothing()
						.returning();

					if (!createdPeriod) {
						// Another transaction already created the period, so we re-read.
						const existing = yield* tx.query.quotaPeriod.findFirst({
							where: {
								AND: [
									{
										quotaPoolId: {
											eq: pool.id,
										},
									},
									{
										status: "open",
									},
								],
							},
						});
						if (existing) {
							period = existing;
						} else {
							return null;
						}
					} else {
						yield* tx
							.insert(dbSchema.quotaLedger)
							.values({
								quotaPoolId: pool.id,
								quotaPeriodId: createdPeriod.id,
								budgetAmount: pool.budgetAmount,
								reservedAmount: 0,
								consumedAmount: 0,
								remainingAmount: pool.budgetAmount,
								version: 0,
								updatedAt: now,
							})
							.onConflictDoNothing();

						period = createdPeriod;
					}
				}

				const [ledger] = yield* tx
					.select()
					.from(dbSchema.quotaLedger)
					.where(
						and(
							eq(dbSchema.quotaLedger.quotaPoolId, pool.id),
							eq(dbSchema.quotaLedger.quotaPeriodId, period.id),
						),
					)
					.limit(1);

				if (!ledger) {
					return null;
				}

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

/** Reserves on the locked ledger row, which decides how much is granted. */
export const reserveQuotaLedger: (params: {
	organizationId: OrganizationId;
	quotaPoolId: QuotaPoolId;
	quotaPeriodId: QuotaPeriodId;
	providerId: ProviderId;
	modelId?: string | null;
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
		const now = new Date();
		const ledgerOf = and(
			eq(dbSchema.quotaLedger.quotaPoolId, params.quotaPoolId),
			eq(dbSchema.quotaLedger.quotaPeriodId, params.quotaPeriodId),
		);

		return yield* db.transaction((tx) =>
			Effect.gen(function* () {
				const [ledger] = yield* tx
					.select()
					.from(dbSchema.quotaLedger)
					.where(ledgerOf)
					.limit(1)
					.for("update");

				if (!ledger) {
					return {
						status: "no_ledger",
					} satisfies LedgerReserveResult;
				}

				const reservedAmount = Math.min(params.amount, ledger.remainingAmount);
				if (reservedAmount < params.minimumAmount || reservedAmount <= 0) {
					return {
						status: "exhausted",
					} satisfies LedgerReserveResult;
				}

				yield* tx.insert(dbSchema.quotaUsageEvent).values({
					organizationId: params.organizationId,
					quotaPoolId: params.quotaPoolId,
					quotaPeriodId: params.quotaPeriodId,
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

				yield* tx
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
				} satisfies LedgerReserveResult;
			}),
		);
	});

export const findReservedQuotaEvent = (params: { reservationKey: string }) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db.query.quotaUsageEvent.findFirst({
			where: {
				AND: [
					{
						reservationKey: params.reservationKey,
					},
					{
						eventType: "reserved",
					},
				],
			},
		});
	});

export const finalizeQuotaLedger: (params: {
	reservationKey: string;
	appRequestId: string;
	actualAmount: number;
	usage: UsageCounts & Partial<EventCost>;
}) => Effect.Effect<LedgerTransitionResult, unknown, DB> = (params) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = new Date();

		return yield* db.transaction((tx) =>
			Effect.gen(function* () {
				const reserved = yield* tx.query.quotaUsageEvent.findFirst({
					where: {
						AND: [
							{
								reservationKey: params.reservationKey,
							},
							{
								eventType: "reserved",
							},
						],
					},
				});

				if (!reserved) {
					return null;
				}

				// Lock the ledger row
				yield* tx
					.select({
						id: dbSchema.quotaLedger.id,
					})
					.from(dbSchema.quotaLedger)
					.where(
						and(
							eq(dbSchema.quotaLedger.quotaPoolId, reserved.quotaPoolId),
							eq(dbSchema.quotaLedger.quotaPeriodId, reserved.quotaPeriodId),
						),
					)
					.limit(1)
					.for("update");

				const inserted = yield* tx
					.insert(dbSchema.quotaUsageEvent)
					.values({
						organizationId: reserved.organizationId,
						quotaPoolId: reserved.quotaPoolId,
						quotaPeriodId: reserved.quotaPeriodId,
						providerId: reserved.providerId,
						modelId: reserved.modelId,
						botId: reserved.botId,
						userId: reserved.userId,
						appRequestId: params.appRequestId,
						eventType: "finalized",
						reservationKey: reserved.reservationKey,
						meteringMode: reserved.meteringMode,
						reservedAmount: reserved.reservedAmount,
						actualAmount: params.actualAmount,
						...params.usage,
						occurredAt: now,
						createdAt: now,
					})
					.onConflictDoNothing()
					.returning({
						id: dbSchema.quotaUsageEvent.id,
					});

				if (inserted.length === 0) {
					return {
						inserted: false,
						reserved,
					};
				}

				yield* tx
					.update(dbSchema.quotaLedger)
					.set({
						reservedAmount: sql`greatest(0, ${dbSchema.quotaLedger.reservedAmount} - ${reserved.reservedAmount})`,
						consumedAmount: sql`${dbSchema.quotaLedger.consumedAmount} + ${params.actualAmount}`,
						remainingAmount: sql`greatest(0, ${dbSchema.quotaLedger.budgetAmount} - (greatest(0, ${dbSchema.quotaLedger.reservedAmount} - ${reserved.reservedAmount})) - (${dbSchema.quotaLedger.consumedAmount} + ${params.actualAmount}))`,
						version: sql`${dbSchema.quotaLedger.version} + 1`,
						updatedAt: now,
					})
					.where(
						and(
							eq(dbSchema.quotaLedger.quotaPoolId, reserved.quotaPoolId),
							eq(dbSchema.quotaLedger.quotaPeriodId, reserved.quotaPeriodId),
						),
					);

				return {
					inserted: true,
					reserved,
				};
			}),
		);
	});

export const releaseQuotaLedger: (params: {
	reservationKey: string;
	appRequestId: string;
	reason: "provider_failure" | "app_failure" | "cancelled" | "expired";
	includeFailureEvent?: boolean;
}) => Effect.Effect<LedgerTransitionResult, unknown, DB> = (params) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = new Date();

		return yield* db.transaction((tx) =>
			Effect.gen(function* () {
				const reserved = yield* tx.query.quotaUsageEvent.findFirst({
					where: {
						AND: [
							{
								reservationKey: params.reservationKey,
							},
							{
								eventType: "reserved",
							},
						],
					},
				});

				if (!reserved) {
					return null;
				}

				// Lock the ledger row
				yield* tx
					.select({
						id: dbSchema.quotaLedger.id,
					})
					.from(dbSchema.quotaLedger)
					.where(
						and(
							eq(dbSchema.quotaLedger.quotaPoolId, reserved.quotaPoolId),
							eq(dbSchema.quotaLedger.quotaPeriodId, reserved.quotaPeriodId),
						),
					)
					.limit(1)
					.for("update");

				const inserted = yield* tx
					.insert(dbSchema.quotaUsageEvent)
					.values({
						organizationId: reserved.organizationId,
						quotaPoolId: reserved.quotaPoolId,
						quotaPeriodId: reserved.quotaPeriodId,
						providerId: reserved.providerId,
						modelId: reserved.modelId,
						botId: reserved.botId,
						userId: reserved.userId,
						appRequestId: params.appRequestId,
						eventType: "released",
						reservationKey: reserved.reservationKey,
						meteringMode: reserved.meteringMode,
						reservedAmount: reserved.reservedAmount,
						actualAmount: 0,
						metadata: {
							reason: params.reason,
						},
						occurredAt: now,
						createdAt: now,
					})
					.onConflictDoNothing()
					.returning({
						id: dbSchema.quotaUsageEvent.id,
					});

				if (inserted.length === 0) {
					return {
						inserted: false,
						reserved,
					};
				}

				yield* tx
					.update(dbSchema.quotaLedger)
					.set({
						reservedAmount: sql`greatest(0, ${dbSchema.quotaLedger.reservedAmount} - ${reserved.reservedAmount})`,
						remainingAmount: sql`greatest(0, ${dbSchema.quotaLedger.budgetAmount} - (greatest(0, ${dbSchema.quotaLedger.reservedAmount} - ${reserved.reservedAmount})) - ${dbSchema.quotaLedger.consumedAmount})`,
						version: sql`${dbSchema.quotaLedger.version} + 1`,
						updatedAt: now,
					})
					.where(
						and(
							eq(dbSchema.quotaLedger.quotaPoolId, reserved.quotaPoolId),
							eq(dbSchema.quotaLedger.quotaPeriodId, reserved.quotaPeriodId),
						),
					);

				if (params.includeFailureEvent) {
					yield* tx
						.insert(dbSchema.quotaUsageEvent)
						.values({
							organizationId: reserved.organizationId,
							quotaPoolId: reserved.quotaPoolId,
							quotaPeriodId: reserved.quotaPeriodId,
							providerId: reserved.providerId,
							modelId: reserved.modelId,
							botId: reserved.botId,
							userId: reserved.userId,
							appRequestId: params.appRequestId,
							eventType: "failed",
							reservationKey: reserved.reservationKey,
							meteringMode: reserved.meteringMode,
							reservedAmount: reserved.reservedAmount,
							actualAmount: 0,
							metadata: {
								reason: params.reason,
							},
							occurredAt: now,
							createdAt: now,
						})
						.onConflictDoNothing({
							target: [
								dbSchema.quotaUsageEvent.reservationKey,
								dbSchema.quotaUsageEvent.eventType,
							],
						});
				}

				return {
					inserted: true,
					reserved,
				};
			}),
		);
	});

/**
 * Releases reservations in open periods that were never settled and were made
 * before `reservedBefore`, as when the process running the call died.
 */
export const releaseStaleQuotaReservations: (params: {
	reservedBefore: Date;
	limit: number;
}) => Effect.Effect<number, unknown, DB> = (params) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const event = dbSchema.quotaUsageEvent;
		const settlement = alias(event, "settlement");

		const stale = yield* db
			.select({
				reservationKey: event.reservationKey,
				appRequestId: event.appRequestId,
			})
			.from(event)
			.innerJoin(
				dbSchema.quotaPeriod,
				and(
					eq(dbSchema.quotaPeriod.id, event.quotaPeriodId),
					eq(dbSchema.quotaPeriod.status, "open"),
				),
			)
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

		const released = yield* Effect.forEach(
			stale,
			(reservation) =>
				releaseQuotaLedger({
					...reservation,
					reason: "expired",
				}),
			{
				concurrency: 10,
			},
		);

		return released.filter((result) => result?.inserted).length;
	});
