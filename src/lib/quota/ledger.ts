import { and, eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { DB } from "@/lib/effect/services/drizzle";
import { getUtcPeriodBounds } from "@/lib/quota/period";

export const createQuotaPoolWithInitialPeriod = (params: {
	organizationId: string;
	name: string;
	description?: string | null;
	providerId: string;
	providerModelId?: string | null;
	periodType: (typeof dbSchema.quotaPool.$inferInsert)["periodType"];
	budgetAmount: number;
	priority: number;
	isDefault: boolean;
	isActive?: boolean;
	createdByUserId: string;
	assignedGroupIds: string[];
}) =>
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
						providerModelId: params.providerModelId ?? null,
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

export const updateQuotaPoolBudget = (params: {
	poolId: string;
	organizationId: string;
	newBudgetAmount: number;
	actorUserId: string;
	skipAuditLog?: boolean;
}) =>
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
								quotaPoolId: pool.id,
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
										quotaPoolId: pool.id,
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

export const reserveQuotaLedger = (params: {
	organizationId: string;
	quotaPoolId: string;
	quotaPeriodId: string;
	providerId: string;
	providerModelId?: string | null;
	userId: string;
	appRequestId: string;
	reservationKey: string;
	meteringMode: (typeof dbSchema.provider.$inferSelect)["meteringMode"];
	reservedAmount: number;
	metadata?: Record<string, unknown>;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = new Date();

		return yield* db.transaction((tx) =>
			Effect.gen(function* () {
				// Lock the ledger row to prevent concurrent reservation races
				const [ledgerRow] = yield* tx
					.select()
					.from(dbSchema.quotaLedger)
					.where(
						and(
							eq(dbSchema.quotaLedger.quotaPoolId, params.quotaPoolId),
							eq(dbSchema.quotaLedger.quotaPeriodId, params.quotaPeriodId),
						),
					)
					.limit(1)
					.for("update");

				if (!ledgerRow) {
					return {
						inserted: false,
					};
				}

				const inserted = yield* tx
					.insert(dbSchema.quotaUsageEvent)
					.values({
						organizationId: params.organizationId,
						quotaPoolId: params.quotaPoolId,
						quotaPeriodId: params.quotaPeriodId,
						providerId: params.providerId,
						providerModelId: params.providerModelId ?? null,
						userId: params.userId,
						appRequestId: params.appRequestId,
						eventType: "reserved",
						reservationKey: params.reservationKey,
						meteringMode: params.meteringMode,
						reservedAmount: params.reservedAmount,
						actualAmount: 0,
						metadata: params.metadata,
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
					};
				}

				yield* tx
					.update(dbSchema.quotaLedger)
					.set({
						reservedAmount: sql`${dbSchema.quotaLedger.reservedAmount} + ${params.reservedAmount}`,
						remainingAmount: sql`greatest(0, ${dbSchema.quotaLedger.budgetAmount} - (${dbSchema.quotaLedger.reservedAmount} + ${params.reservedAmount}) - ${dbSchema.quotaLedger.consumedAmount})`,
						version: sql`${dbSchema.quotaLedger.version} + 1`,
						updatedAt: now,
					})
					.where(
						and(
							eq(dbSchema.quotaLedger.quotaPoolId, params.quotaPoolId),
							eq(dbSchema.quotaLedger.quotaPeriodId, params.quotaPeriodId),
						),
					);

				return {
					inserted: true,
				};
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

export const finalizeQuotaLedger = (params: {
	reservationKey: string;
	appRequestId: string;
	actualAmount: number;
	requestCount?: number;
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
	metadata?: Record<string, unknown>;
}) =>
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
						providerModelId: reserved.providerModelId,
						userId: reserved.userId,
						appRequestId: params.appRequestId,
						eventType: "finalized",
						reservationKey: reserved.reservationKey,
						meteringMode: reserved.meteringMode,
						reservedAmount: reserved.reservedAmount,
						actualAmount: params.actualAmount,
						requestCount: params.requestCount,
						inputTokens: params.inputTokens,
						outputTokens: params.outputTokens,
						totalTokens: params.totalTokens,
						metadata: params.metadata,
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

export const releaseQuotaLedger = (params: {
	reservationKey: string;
	appRequestId: string;
	reason: "provider_failure" | "app_failure" | "cancelled";
	includeFailureEvent?: boolean;
}) =>
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
						providerModelId: reserved.providerModelId,
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
							providerModelId: reserved.providerModelId,
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
