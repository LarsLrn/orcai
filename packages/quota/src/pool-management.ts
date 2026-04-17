import type {
	GroupId,
	ModelId,
	OrganizationId,
	ProviderId,
	QuotaPoolId,
	UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { QuotaCounterStore } from "./counter-store";
import {
	createQuotaPoolWithInitialPeriod,
	updateQuotaPoolBudget,
} from "./ledger";

type QuotaPool = typeof dbSchema.quotaPool.$inferSelect;

type CreateQuotaPoolParams = {
	organizationId: OrganizationId;
	name: string;
	description?: string | null;
	providerId: ProviderId;
	providerModelId?: ModelId | null;
	periodType: (typeof dbSchema.quotaPool.$inferInsert)["periodType"];
	budgetAmount: number;
	priority: number;
	isDefault: boolean;
	isActive?: boolean;
	createdByUserId: UserId;
	groupIds: GroupId[];
};

type UpdateQuotaPoolParams = {
	organizationId: OrganizationId;
	actorUserId: UserId;
	id: QuotaPoolId;
	name?: string;
	description?: string | null;
	providerModelId?: ModelId | null;
	periodType?: (typeof dbSchema.quotaPool.$inferInsert)["periodType"];
	budgetAmount?: number;
	priority?: number;
	isDefault?: boolean;
	isActive?: boolean;
	groupIds?: GroupId[];
};

type ResultCode =
	| "ok"
	| "pool_not_found"
	| "provider_not_found"
	| "model_invalid"
	| "groups_invalid";

export type WriteQuotaPoolResult =
	| {
			status: "ok";
			pool: QuotaPool;
	  }
	| {
			status: Exclude<ResultCode, "ok">;
	  };

const selectOrganizationProvider = (params: {
	organizationId: OrganizationId;
	providerId: ProviderId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const [provider] = yield* db
			.select({
				id: dbSchema.provider.id,
				organizationId: dbSchema.provider.organizationId,
			})
			.from(dbSchema.provider)
			.where(
				and(
					eq(dbSchema.provider.id, params.providerId),
					eq(dbSchema.provider.organizationId, params.organizationId),
				),
			)
			.limit(1);

		return provider ?? null;
	});

const validateProviderModel = (params: {
	providerId: ProviderId;
	providerModelId?: ModelId | null;
}) =>
	Effect.gen(function* () {
		if (!params.providerModelId) {
			return true;
		}

		const db = yield* DB;
		const [model] = yield* db
			.select({
				id: dbSchema.model.id,
				providerId: dbSchema.model.providerId,
			})
			.from(dbSchema.model)
			.where(eq(dbSchema.model.id, params.providerModelId))
			.limit(1);

		return !!model && model.providerId === params.providerId;
	});

const validateGroupAssignments = (params: {
	organizationId: OrganizationId;
	groupIds: GroupId[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const groups = yield* db
			.select({
				id: dbSchema.group.id,
			})
			.from(dbSchema.group)
			.where(
				and(
					eq(dbSchema.group.organizationId, params.organizationId),
					inArray(dbSchema.group.id, params.groupIds),
					isNull(dbSchema.group.deletedAt),
				),
			);

		return groups.length === params.groupIds.length;
	});

export const createQuotaPool: (
	params: CreateQuotaPoolParams,
) => Effect.Effect<WriteQuotaPoolResult, unknown, DB> = (params) =>
	Effect.gen(function* () {
		const provider = yield* selectOrganizationProvider({
			organizationId: params.organizationId,
			providerId: params.providerId,
		});

		if (!provider) {
			return {
				status: "provider_not_found",
			} satisfies WriteQuotaPoolResult;
		}

		const modelValid = yield* validateProviderModel({
			providerId: provider.id,
			providerModelId: params.providerModelId,
		});

		if (!modelValid) {
			return {
				status: "model_invalid",
			} satisfies WriteQuotaPoolResult;
		}

		const groupsValid = yield* validateGroupAssignments({
			organizationId: params.organizationId,
			groupIds: params.groupIds,
		});

		if (!groupsValid) {
			return {
				status: "groups_invalid",
			} satisfies WriteQuotaPoolResult;
		}

		const created = yield* createQuotaPoolWithInitialPeriod({
			organizationId: params.organizationId,
			name: params.name,
			description: params.description,
			providerId: params.providerId,
			providerModelId: params.providerModelId,
			periodType: params.periodType,
			budgetAmount: params.budgetAmount,
			priority: params.priority,
			isDefault: params.isDefault,
			isActive: params.isActive,
			createdByUserId: params.createdByUserId,
			assignedGroupIds: params.groupIds,
		});

		return {
			status: "ok",
			pool: created.pool,
		} satisfies WriteQuotaPoolResult;
	});

export const updateQuotaPool: (
	params: UpdateQuotaPoolParams,
) => Effect.Effect<WriteQuotaPoolResult, unknown, DB | QuotaCounterStore> = (
	params,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const counterStore = yield* QuotaCounterStore;

		const [pool] = yield* db
			.select()
			.from(dbSchema.quotaPool)
			.where(
				and(
					eq(dbSchema.quotaPool.id, params.id),
					eq(dbSchema.quotaPool.organizationId, params.organizationId),
				),
			)
			.limit(1);

		if (!pool) {
			return {
				status: "pool_not_found",
			} satisfies WriteQuotaPoolResult;
		}

		const modelValid = yield* validateProviderModel({
			providerId: pool.providerId,
			providerModelId: params.providerModelId,
		});

		if (!modelValid) {
			return {
				status: "model_invalid",
			} satisfies WriteQuotaPoolResult;
		}

		if (params.groupIds !== undefined) {
			const groupsValid = yield* validateGroupAssignments({
				organizationId: params.organizationId,
				groupIds: params.groupIds,
			});

			if (!groupsValid) {
				return {
					status: "groups_invalid",
				} satisfies WriteQuotaPoolResult;
			}
		}

		let budgetChanged = false;
		const previousBudgetAmount = pool.budgetAmount;
		let updatedPool = pool;

		if (
			params.budgetAmount !== undefined &&
			params.budgetAmount !== pool.budgetAmount
		) {
			const updatedBudget = yield* updateQuotaPoolBudget({
				poolId: pool.id,
				organizationId: params.organizationId,
				newBudgetAmount: params.budgetAmount,
				actorUserId: params.actorUserId,
				skipAuditLog: true,
			});

			if (!updatedBudget) {
				return {
					status: "pool_not_found",
				} satisfies WriteQuotaPoolResult;
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
			(params.name !== undefined && params.name !== updatedPool.name) ||
			(params.description !== undefined &&
				params.description !== updatedPool.description) ||
			(params.providerModelId !== undefined &&
				params.providerModelId !== updatedPool.providerModelId) ||
			(params.periodType !== undefined &&
				params.periodType !== updatedPool.periodType) ||
			(params.priority !== undefined &&
				params.priority !== updatedPool.priority) ||
			(params.isDefault !== undefined &&
				params.isDefault !== updatedPool.isDefault) ||
			(params.isActive !== undefined &&
				params.isActive !== updatedPool.isActive);

		const patch = {
			name: params.name ?? updatedPool.name,
			description:
				params.description === undefined
					? updatedPool.description
					: params.description,
			providerModelId:
				params.providerModelId === undefined
					? updatedPool.providerModelId
					: params.providerModelId,
			periodType: params.periodType ?? updatedPool.periodType,
			priority: params.priority ?? updatedPool.priority,
			isDefault: params.isDefault ?? updatedPool.isDefault,
			isActive: params.isActive ?? updatedPool.isActive,
			updatedAt: new Date(),
		};

		let finalPool = updatedPool;
		if (hasNonBudgetUpdate) {
			const [patchedPool] = yield* db
				.update(dbSchema.quotaPool)
				.set(patch)
				.where(eq(dbSchema.quotaPool.id, params.id))
				.returning();

			finalPool = patchedPool;
		}

		if (hasNonBudgetUpdate || budgetChanged) {
			yield* db.insert(dbSchema.quotaPoolAuditLog).values({
				organizationId: params.organizationId,
				quotaPoolId: params.id,
				actorUserId: params.actorUserId,
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

		if (params.groupIds !== undefined) {
			const now = new Date();
			const currentAssignments =
				yield* db.query.quotaPoolGroupAssignment.findMany({
					where: {
						AND: [
							{
								quotaPoolId: {
									eq: params.id,
								},
							},
							{
								isActive: true,
							},
						],
					},
				});

			const currentGroupIds = new Set(currentAssignments.map((a) => a.groupId));
			const newGroupIds = new Set(params.groupIds);

			const toAdd = params.groupIds.filter((id) => !currentGroupIds.has(id));
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
							eq(dbSchema.quotaPoolGroupAssignment.quotaPoolId, params.id),
							inArray(dbSchema.quotaPoolGroupAssignment.groupId, toRemove),
						),
					);
			}

			for (const groupId of toAdd) {
				const existing = yield* db.query.quotaPoolGroupAssignment.findFirst({
					where: {
						AND: [
							{
								quotaPoolId: {
									eq: params.id,
								},
							},
							{
								groupId: {
									eq: groupId,
								},
							},
						],
					},
				});

				if (existing) {
					yield* db
						.update(dbSchema.quotaPoolGroupAssignment)
						.set({
							isActive: true,
							updatedAt: now,
							createdByUserId: params.actorUserId,
						})
						.where(eq(dbSchema.quotaPoolGroupAssignment.id, existing.id));
				} else {
					yield* db.insert(dbSchema.quotaPoolGroupAssignment).values({
						quotaPoolId: params.id,
						groupId,
						isActive: true,
						createdByUserId: params.actorUserId,
						createdAt: now,
						updatedAt: now,
					});
				}
			}

			if (toAdd.length > 0 || toRemove.length > 0) {
				yield* db.insert(dbSchema.quotaPoolAuditLog).values({
					organizationId: params.organizationId,
					quotaPoolId: params.id,
					actorUserId: params.actorUserId,
					actionType: "pool_groups_updated",
					beforeState: {
						groupIds: [
							...currentGroupIds,
						],
					},
					afterState: {
						groupIds: params.groupIds,
					},
					createdAt: now,
				});
			}
		}

		return {
			status: "ok",
			pool: finalPool,
		} satisfies WriteQuotaPoolResult;
	});

export const deactivateQuotaPool: (params: {
	organizationId: OrganizationId;
	actorUserId: UserId;
	id: QuotaPoolId;
}) => Effect.Effect<WriteQuotaPoolResult, unknown, DB> = (params) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = new Date();

		const [existingPool] = yield* db
			.select()
			.from(dbSchema.quotaPool)
			.where(
				and(
					eq(dbSchema.quotaPool.id, params.id),
					eq(dbSchema.quotaPool.organizationId, params.organizationId),
				),
			)
			.limit(1);

		if (!existingPool) {
			return {
				status: "pool_not_found",
			} satisfies WriteQuotaPoolResult;
		}

		const [pool] = yield* db
			.update(dbSchema.quotaPool)
			.set({
				isActive: false,
				updatedAt: now,
			})
			.where(
				and(
					eq(dbSchema.quotaPool.id, params.id),
					eq(dbSchema.quotaPool.organizationId, params.organizationId),
				),
			)
			.returning();

		yield* db.insert(dbSchema.quotaPoolAuditLog).values({
			organizationId: params.organizationId,
			quotaPoolId: pool.id,
			actorUserId: params.actorUserId,
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
			status: "ok",
			pool,
		} satisfies WriteQuotaPoolResult;
	});
