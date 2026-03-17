import { and, count, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/org-permission";
import {
	type CheckPermissionInput,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import { QuotaCounterStore } from "@/lib/quota/counter-store";
import {
	createQuotaPoolWithInitialPeriod,
	updateQuotaPoolBudget,
} from "@/lib/quota/ledger";
import { resolveQuotaPool } from "@/lib/quota/resolver";

const getCurrentPeriodAndLedger = (params: { quotaPoolId: string }) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const period = yield* db.query.quotaPeriod.findFirst({
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
			orderBy: {
				startsAt: "desc",
			},
		});

		if (!period) {
			return {
				period: null,
				ledger: null,
			};
		}

		const ledger = yield* db.query.quotaLedger.findFirst({
			where: {
				AND: [
					{
						quotaPoolId: params.quotaPoolId,
					},
					{
						quotaPeriodId: period.id,
					},
				],
			},
		});

		return {
			period,
			ledger: ledger ?? null,
		};
	});

export const listQuotaPools = authed.quota.list
	.use(requireOrganizationPermission("read"))
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const organizationId = context.auth.session.activeOrganizationId;

				const conditions = [
					eq(dbSchema.quotaPool.organizationId, organizationId),
					input.filters?.providerId
						? eq(dbSchema.quotaPool.providerId, input.filters.providerId)
						: undefined,
					input.filters?.isActive !== undefined
						? eq(dbSchema.quotaPool.isActive, input.filters.isActive)
						: undefined,
					input.filters?.search
						? ilike(dbSchema.quotaPool.name, `%${input.filters.search}%`)
						: undefined,
				].filter((condition) => condition !== undefined);

				const whereClause =
					conditions.length > 0 ? and(...conditions) : undefined;

				const [rows, [rowCount]] = yield* Effect.all(
					[
						db
							.select({
								pool: dbSchema.quotaPool,
								provider: dbSchema.provider,
							})
							.from(dbSchema.quotaPool)
							.innerJoin(
								dbSchema.provider,
								eq(dbSchema.provider.id, dbSchema.quotaPool.providerId),
							)
							.where(whereClause)
							.orderBy(
								desc(dbSchema.quotaPool.isActive),
								desc(dbSchema.quotaPool.priority),
								dbSchema.quotaPool.createdAt,
							)
							.limit(input.pageSize)
							.offset(input.pageIndex * input.pageSize),
						db
							.select({
								count: count(),
							})
							.from(dbSchema.quotaPool)
							.where(whereClause),
					],
					{
						concurrency: "unbounded",
					},
				);

				const data = yield* Effect.forEach(
					rows,
					(row) =>
						Effect.gen(function* () {
							const state = yield* getCurrentPeriodAndLedger({
								quotaPoolId: row.pool.id,
							});

							return {
								...row.pool,
								provider: row.provider,
								currentPeriod: state.period,
								currentLedger: state.ledger,
							};
						}),
					{
						concurrency: 6,
					},
				);

				return {
					data,
					rowCount: rowCount.count,
				};
			}),
		),
	);

export const findQuotaPool = authed.quota.find
	.use(requireOrganizationPermission("read"))
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const organizationId = context.auth.session.activeOrganizationId;

				const [row] = yield* db
					.select({
						pool: dbSchema.quotaPool,
						provider: dbSchema.provider,
					})
					.from(dbSchema.quotaPool)
					.innerJoin(
						dbSchema.provider,
						eq(dbSchema.provider.id, dbSchema.quotaPool.providerId),
					)
					.where(
						and(
							eq(dbSchema.quotaPool.id, input.id),
							eq(dbSchema.quotaPool.organizationId, organizationId),
						),
					)
					.limit(1);

				if (!row) {
					return yield* Effect.fail(
						errors.NOT_FOUND({
							message: "Quota pool not found",
						}),
					);
				}

				const [state, assignments, recentEvents] = yield* Effect.all(
					[
						getCurrentPeriodAndLedger({
							quotaPoolId: row.pool.id,
						}),
						db.query.quotaPoolGroupAssignment.findMany({
							where: {
								AND: [
									{
										quotaPoolId: row.pool.id,
									},
									{
										isActive: true,
									},
								],
							},
							orderBy: {
								createdAt: "desc",
							},
						}),
						db.query.quotaUsageEvent.findMany({
							where: {
								quotaPoolId: row.pool.id,
							},
							orderBy: {
								occurredAt: "desc",
							},
							limit: 50,
						}),
					],
					{
						concurrency: "unbounded",
					},
				);

				return {
					data: {
						...row.pool,
						provider: row.provider,
						currentPeriod: state.period,
						currentLedger: state.ledger,
						assignments,
						recentEvents,
					},
				};
			}),
		),
	);

export const createQuotaPool = authed.quota.create
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const organizationId = context.auth.session.activeOrganizationId;

				const [provider] = yield* db
					.select({
						id: dbSchema.provider.id,
						organizationId: dbSchema.provider.organizationId,
					})
					.from(dbSchema.provider)
					.where(
						and(
							eq(dbSchema.provider.id, input.providerId),
							eq(dbSchema.provider.organizationId, organizationId),
						),
					)
					.limit(1);

				if (!provider) {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message: "Provider not found in active organization",
						}),
					);
				}

				if (input.providerModelId) {
					const [model] = yield* db
						.select({
							id: dbSchema.model.id,
							providerId: dbSchema.model.providerId,
						})
						.from(dbSchema.model)
						.where(eq(dbSchema.model.id, input.providerModelId))
						.limit(1);

					if (!model || model.providerId !== provider.id) {
						return yield* Effect.fail(
							errors.BAD_REQUEST({
								message: "Model does not belong to selected provider",
							}),
						);
					}
				}

				const groups = yield* db
					.select({
						id: dbSchema.group.id,
					})
					.from(dbSchema.group)
					.where(
						and(
							eq(dbSchema.group.organizationId, organizationId),
							inArray(dbSchema.group.id, input.groupIds),
							isNull(dbSchema.group.deletedAt),
						),
					);

				if (groups.length !== input.groupIds.length) {
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message: "One or more group assignments are invalid",
						}),
					);
				}

				const created = yield* createQuotaPoolWithInitialPeriod({
					organizationId,
					name: input.name,
					description: input.description,
					providerId: input.providerId,
					providerModelId: input.providerModelId,
					periodType: input.periodType,
					budgetAmount: input.budgetAmount,
					priority: input.priority,
					isDefault: input.isDefault,
					isActive: input.isActive,
					createdByUserId: context.auth.user.id,
					assignedGroupIds: input.groupIds,
				});

				return {
					data: created.pool,
				};
			}),
		),
	);

export const updateQuotaPool = authed.quota.update
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const counterStore = yield* QuotaCounterStore;
				const organizationId = context.auth.session.activeOrganizationId;

				const [pool] = yield* db
					.select()
					.from(dbSchema.quotaPool)
					.where(
						and(
							eq(dbSchema.quotaPool.id, input.id),
							eq(dbSchema.quotaPool.organizationId, organizationId),
						),
					)
					.limit(1);

				if (!pool) {
					return yield* Effect.fail(
						errors.NOT_FOUND({
							message: "Quota pool not found",
						}),
					);
				}

				if (input.providerModelId) {
					const [model] = yield* db
						.select({
							id: dbSchema.model.id,
							providerId: dbSchema.model.providerId,
						})
						.from(dbSchema.model)
						.where(eq(dbSchema.model.id, input.providerModelId))
						.limit(1);

					if (!model || model.providerId !== pool.providerId) {
						return yield* Effect.fail(
							errors.BAD_REQUEST({
								message: "Model does not belong to pool provider",
							}),
						);
					}
				}

				let budgetChanged = false;
				const previousBudgetAmount = pool.budgetAmount;
				let updatedPool = pool;

				if (
					input.budgetAmount !== undefined &&
					input.budgetAmount !== pool.budgetAmount
				) {
					const updatedBudget = yield* updateQuotaPoolBudget({
						poolId: pool.id,
						organizationId,
						newBudgetAmount: input.budgetAmount,
						actorUserId: context.auth.user.id,
						skipAuditLog: true,
					});

					if (!updatedBudget) {
						return yield* Effect.fail(
							errors.NOT_FOUND({
								message: "Quota pool not found",
							}),
						);
					}

					updatedPool = updatedBudget.pool;
					budgetChanged = true;
					yield* counterStore.overwriteState({
						poolId: updatedBudget.pool.id,
						periodId: updatedBudget.period.id,
						remaining: updatedBudget.ledger.remainingAmount,
						reserved: updatedBudget.ledger.reservedAmount,
						consumed: updatedBudget.ledger.consumedAmount,
					});
				}

				const hasNonBudgetUpdate =
					(input.name !== undefined && input.name !== updatedPool.name) ||
					(input.description !== undefined &&
						input.description !== updatedPool.description) ||
					(input.providerModelId !== undefined &&
						input.providerModelId !== updatedPool.providerModelId) ||
					(input.periodType !== undefined &&
						input.periodType !== updatedPool.periodType) ||
					(input.priority !== undefined &&
						input.priority !== updatedPool.priority) ||
					(input.isDefault !== undefined &&
						input.isDefault !== updatedPool.isDefault) ||
					(input.isActive !== undefined &&
						input.isActive !== updatedPool.isActive);

				const patch = {
					name: input.name ?? updatedPool.name,
					description:
						input.description === undefined
							? updatedPool.description
							: input.description,
					providerModelId:
						input.providerModelId === undefined
							? updatedPool.providerModelId
							: input.providerModelId,
					periodType: input.periodType ?? updatedPool.periodType,
					priority: input.priority ?? updatedPool.priority,
					isDefault: input.isDefault ?? updatedPool.isDefault,
					isActive: input.isActive ?? updatedPool.isActive,
					updatedAt: new Date(),
				};

				let finalPool = updatedPool;
				if (hasNonBudgetUpdate) {
					const [patchedPool] = yield* db
						.update(dbSchema.quotaPool)
						.set(patch)
						.where(eq(dbSchema.quotaPool.id, input.id))
						.returning();

					finalPool = patchedPool;
				}

				if (hasNonBudgetUpdate || budgetChanged) {
					yield* db.insert(dbSchema.quotaPoolAuditLog).values({
						organizationId,
						quotaPoolId: input.id,
						actorUserId: context.auth.user.id,
						actionType:
							budgetChanged && hasNonBudgetUpdate
								? "pool_updated"
								: budgetChanged
									? "pool_budget_updated"
									: "pool_updated",
						beforeState: {
							...(hasNonBudgetUpdate && {
								name: pool.name,
								description: pool.description,
								providerModelId: pool.providerModelId,
								periodType: pool.periodType,
								priority: pool.priority,
								isDefault: pool.isDefault,
								isActive: pool.isActive,
							}),
							...(budgetChanged && {
								budgetAmount: previousBudgetAmount,
							}),
						},
						afterState: {
							...(hasNonBudgetUpdate && {
								name: finalPool.name,
								description: finalPool.description,
								providerModelId: finalPool.providerModelId,
								periodType: finalPool.periodType,
								priority: finalPool.priority,
								isDefault: finalPool.isDefault,
								isActive: finalPool.isActive,
							}),
							...(budgetChanged && {
								budgetAmount: finalPool.budgetAmount,
							}),
						},
						createdAt: new Date(),
					});
				}

				if (input.groupIds !== undefined) {
					const now = new Date();

					const validGroups = yield* db
						.select({
							id: dbSchema.group.id,
						})
						.from(dbSchema.group)
						.where(
							and(
								eq(dbSchema.group.organizationId, organizationId),
								inArray(dbSchema.group.id, input.groupIds),
								isNull(dbSchema.group.deletedAt),
							),
						);

					if (validGroups.length !== input.groupIds.length) {
						return yield* Effect.fail(
							errors.BAD_REQUEST({
								message: "One or more group assignments are invalid",
							}),
						);
					}

					const currentAssignments =
						yield* db.query.quotaPoolGroupAssignment.findMany({
							where: {
								AND: [
									{
										quotaPoolId: input.id,
									},
									{
										isActive: true,
									},
								],
							},
						});

					const currentGroupIds = new Set(
						currentAssignments.map((a) => a.groupId),
					);
					const newGroupIds = new Set(input.groupIds);

					const toAdd = input.groupIds.filter((id) => !currentGroupIds.has(id));
					const toRemove = [
						...currentGroupIds,
					].filter((id) => !newGroupIds.has(id));

					if (toRemove.length > 0) {
						yield* db
							.update(dbSchema.quotaPoolGroupAssignment)
							.set({
								isActive: false,
								updatedAt: now,
							})
							.where(
								and(
									eq(dbSchema.quotaPoolGroupAssignment.quotaPoolId, input.id),
									inArray(dbSchema.quotaPoolGroupAssignment.groupId, toRemove),
								),
							);
					}

					for (const groupId of toAdd) {
						const existing = yield* db.query.quotaPoolGroupAssignment.findFirst(
							{
								where: {
									AND: [
										{
											quotaPoolId: input.id,
										},
										{
											groupId,
										},
									],
								},
							},
						);

						if (existing) {
							yield* db
								.update(dbSchema.quotaPoolGroupAssignment)
								.set({
									isActive: true,
									updatedAt: now,
									createdByUserId: context.auth.user.id,
								})
								.where(eq(dbSchema.quotaPoolGroupAssignment.id, existing.id));
						} else {
							yield* db.insert(dbSchema.quotaPoolGroupAssignment).values({
								quotaPoolId: input.id,
								groupId,
								isActive: true,
								createdByUserId: context.auth.user.id,
								createdAt: now,
								updatedAt: now,
							});
						}
					}

					if (toAdd.length > 0 || toRemove.length > 0) {
						yield* db.insert(dbSchema.quotaPoolAuditLog).values({
							organizationId,
							quotaPoolId: input.id,
							actorUserId: context.auth.user.id,
							actionType: "pool_groups_updated",
							beforeState: {
								groupIds: [
									...currentGroupIds,
								],
							},
							afterState: {
								groupIds: input.groupIds,
							},
							createdAt: now,
						});
					}
				}

				return {
					data: finalPool,
				};
			}),
		),
	);

export const deactivateQuotaPool = authed.quota.deactivate
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const organizationId = context.auth.session.activeOrganizationId;
				const now = new Date();

				const [existingPool] = yield* db
					.select()
					.from(dbSchema.quotaPool)
					.where(
						and(
							eq(dbSchema.quotaPool.id, input.id),
							eq(dbSchema.quotaPool.organizationId, organizationId),
						),
					)
					.limit(1);

				if (!existingPool) {
					return yield* Effect.fail(
						errors.NOT_FOUND({
							message: "Quota pool not found",
						}),
					);
				}

				const [pool] = yield* db
					.update(dbSchema.quotaPool)
					.set({
						isActive: false,
						updatedAt: now,
					})
					.where(
						and(
							eq(dbSchema.quotaPool.id, input.id),
							eq(dbSchema.quotaPool.organizationId, organizationId),
						),
					)
					.returning();

				yield* db.insert(dbSchema.quotaPoolAuditLog).values({
					organizationId,
					quotaPoolId: pool.id,
					actorUserId: context.auth.user.id,
					actionType: "pool_deactivated",
					beforeState: {
						isActive: existingPool.isActive,
					},
					afterState: {
						isActive: pool.isActive,
					},
					createdAt: now,
				});

				return {
					data: pool,
				};
			}),
		),
	);

// TODO: Consider restricting pool budget/usage data to admin users.
// Currently any user with chat-read access can see pool budget details.
export const quotaChatBadge = authed.quota.chatBadge
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.chatId,
				permission: "read",
				entityType: "chat",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const organizationId = context.auth.session.activeOrganizationId;
				if (!organizationId) {
					return {
						data: {
							poolId: null,
							poolName: null,
							meteringMode: null,
							remainingAmount: null,
							consumedAmount: null,
							reservedAmount: null,
							periodEndsAt: null,
						},
					};
				}

				const chat = yield* db.query.chat.findFirst({
					where: {
						id: input.chatId,
					},
					columns: {
						botId: true,
					},
				});

				if (!chat?.botId) {
					return {
						data: {
							poolId: null,
							poolName: null,
							meteringMode: null,
							remainingAmount: null,
							consumedAmount: null,
							reservedAmount: null,
							periodEndsAt: null,
						},
					};
				}

				const [templateBlockRow] = yield* db
					.select({
						config: dbSchema.block.config,
					})
					.from(dbSchema.botBlock)
					.innerJoin(
						dbSchema.block,
						eq(dbSchema.block.id, dbSchema.botBlock.blockId),
					)
					.where(
						and(
							eq(dbSchema.botBlock.botId, chat.botId),
							eq(dbSchema.block.type, "template"),
						),
					)
					.limit(1);

				const templateConfig = (templateBlockRow?.config ?? {}) as {
					provider?: string;
					model?: string;
				};

				if (!templateConfig.provider || !templateConfig.model) {
					return {
						data: {
							poolId: null,
							poolName: null,
							meteringMode: null,
							remainingAmount: null,
							consumedAmount: null,
							reservedAmount: null,
							periodEndsAt: null,
						},
					};
				}

				const resolved = yield* resolveQuotaPool({
					orgId: organizationId,
					userId: context.auth.user.id,
					providerId: templateConfig.provider,
					providerModelId: templateConfig.model,
				});

				const winning = resolved.winningPool;
				if (!winning) {
					return {
						data: {
							poolId: null,
							poolName: null,
							meteringMode: null,
							remainingAmount: null,
							consumedAmount: null,
							reservedAmount: null,
							periodEndsAt: null,
						},
					};
				}

				return {
					data: {
						poolId: winning.pool.id,
						poolName: winning.pool.name,
						meteringMode: winning.meteringMode,
						remainingAmount: winning.ledger.remainingAmount,
						consumedAmount: winning.ledger.consumedAmount,
						reservedAmount: winning.ledger.reservedAmount,
						periodEndsAt: winning.period.endsAt,
					},
				};
			}),
		),
	);
