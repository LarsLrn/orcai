import type { QuotaPoolId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	createQuotaPool as createQuotaPoolCommand,
	deactivateQuotaPool as deactivateQuotaPoolCommand,
	updateQuotaPool as updateQuotaPoolCommand,
	type WriteQuotaPoolResult,
} from "@orcai/quota";
import type { QuotaPoolSortKey, QuotaUsageEventSortKey } from "@orcai/schema";
import { and, asc, count, desc, eq, ilike, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	memberMatching,
	usageIdentities,
} from "@/lib/analytics/usage-identities";
import { groupMemberCount } from "@/lib/authz/group-membership";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/permission";
import { literalSearch } from "@/lib/utils/literal-search";
import { buildOrderBy, type SortExpression } from "./helpers/sorting";

const quotaPoolWriteError = (
	status: Exclude<WriteQuotaPoolResult["status"], "ok">,
) => {
	switch (status) {
		case "pool_not_found":
			return new AppErrors.NotFoundError({
				reason: "QUOTA_POOL_NOT_FOUND",
				message: "Quota pool not found",
			});
		case "provider_not_found":
			return new AppErrors.BadRequestError({
				reason: "PROVIDER_NOT_FOUND",
				message: "Provider not found in active organization",
			});
		case "model_invalid":
			return new AppErrors.BadRequestError({
				reason: "MODEL_PROVIDER_MISMATCH",
				message: "Model does not belong to the pool provider",
			});
		case "groups_invalid":
			return new AppErrors.BadRequestError({
				reason: "QUOTA_GROUPS_INVALID",
				message: "One or more group assignments are invalid",
			});
	}
};

const getCurrentPeriodAndLedger = (params: { quotaPoolId: QuotaPoolId }) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const period = yield* db.query.quotaPeriod.findFirst({
			where: {
				AND: [
					{
						quotaPoolId: {
							eq: params.quotaPoolId,
						},
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
						quotaPoolId: {
							eq: params.quotaPoolId,
						},
					},
					{
						quotaPeriodId: {
							eq: period.id,
						},
					},
				],
			},
		});

		return {
			period,
			ledger: ledger ?? null,
		};
	});

const listQuotaPools = authed.quotaPool.list
	.use(requireOrganizationPermission("manage_quota_pools"))
	.effect(function* ({ input, context }) {
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
				? ilike(dbSchema.quotaPool.name, literalSearch(input.filters.search))
				: undefined,
		].filter((condition) => condition !== undefined);

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const orderBy = yield* buildOrderBy({
			sort: input.sort,
			allowlist: {
				name: dbSchema.quotaPool.name,
				periodType: dbSchema.quotaPool.periodType,
				isActive: dbSchema.quotaPool.isActive,
				isDefault: dbSchema.quotaPool.isDefault,
				priority: dbSchema.quotaPool.priority,
				createdAt: dbSchema.quotaPool.createdAt,
				updatedAt: dbSchema.quotaPool.updatedAt,
			} satisfies Record<QuotaPoolSortKey, SortExpression>,
			defaultOrder: [
				desc(dbSchema.quotaPool.createdAt),
			],
			tieBreaker: {
				id: "id",
				expression: dbSchema.quotaPool.id,
			},
		});

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
					.orderBy(...orderBy)
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
	});

const findQuotaPool = authed.quotaPool.find
	.use(requireOrganizationPermission("manage_quota_pools"))
	.effect(function* ({ input, context }) {
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
				new AppErrors.NotFoundError({
					reason: "QUOTA_POOL_NOT_FOUND",
					message: "Quota pool not found",
				}),
			);
		}

		const [state, assignments] = yield* Effect.all(
			[
				getCurrentPeriodAndLedger({
					quotaPoolId: row.pool.id,
				}),
				db
					.select({
						id: dbSchema.quotaPoolGroupAssignment.id,
						groupId: dbSchema.quotaPoolGroupAssignment.groupId,
						isActive: dbSchema.quotaPoolGroupAssignment.isActive,
						createdAt: dbSchema.quotaPoolGroupAssignment.createdAt,
						updatedAt: dbSchema.quotaPoolGroupAssignment.updatedAt,
						group: {
							id: dbSchema.group.id,
							name: dbSchema.group.name,
							description: dbSchema.group.description,
							kind: dbSchema.group.kind,
							systemKey: dbSchema.group.systemKey,
							memberCount: groupMemberCount,
						},
					})
					.from(dbSchema.quotaPoolGroupAssignment)
					.innerJoin(
						dbSchema.group,
						eq(dbSchema.group.id, dbSchema.quotaPoolGroupAssignment.groupId),
					)
					.where(
						and(
							eq(dbSchema.quotaPoolGroupAssignment.quotaPoolId, row.pool.id),
							eq(dbSchema.quotaPoolGroupAssignment.isActive, true),
							isNull(dbSchema.group.deletedAt),
						),
					)
					.orderBy(asc(dbSchema.group.name), asc(dbSchema.group.id)),
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
			},
		};
	});

const listQuotaUsageEvents = authed.quotaPool.listEvents
	.use(requireOrganizationPermission("manage_quota_pools"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;
		const event = dbSchema.quotaUsageEvent;

		const whereClause = and(
			eq(event.organizationId, organizationId),
			eq(event.quotaPoolId, input.quotaPoolId),
			input.filters?.eventType
				? eq(event.eventType, input.filters.eventType)
				: undefined,
			input.filters?.search
				? memberMatching(
						organizationId,
						event.userId,
						literalSearch(input.filters.search),
					)
				: undefined,
		);

		const orderBy = yield* buildOrderBy({
			sort: input.sort,
			allowlist: {
				occurredAt: event.occurredAt,
				eventType: event.eventType,
				reservedAmount: event.reservedAmount,
				actualAmount: event.actualAmount,
			} satisfies Record<QuotaUsageEventSortKey, SortExpression>,
			defaultOrder: [
				desc(event.occurredAt),
			],
			tieBreaker: {
				id: "id",
				expression: event.id,
			},
		});

		const [rows, [rowCount]] = yield* Effect.all(
			[
				db
					.select({
						id: event.id,
						eventType: event.eventType,
						appRequestId: event.appRequestId,
						reservedAmount: event.reservedAmount,
						actualAmount: event.actualAmount,
						totalTokens: event.totalTokens,
						occurredAt: event.occurredAt,
						userId: event.userId,
						botId: event.botId,
						model: {
							id: dbSchema.model.id,
							name: dbSchema.model.name,
						},
					})
					.from(event)
					.leftJoin(dbSchema.model, eq(dbSchema.model.id, event.modelId))
					.where(whereClause)
					.orderBy(...orderBy)
					.limit(input.pageSize)
					.offset(input.pageIndex * input.pageSize),
				db
					.select({
						count: count(),
					})
					.from(event)
					.where(whereClause),
			],
			{
				concurrency: "unbounded",
			},
		);

		const identities = yield* usageIdentities({
			organizationId,
			viewer: {
				userId: context.auth.user.id,
				zedToken: getZedToken(context),
			},
			userIds: rows.map(({ userId }) => userId),
			botIds: rows.map(({ botId }) => botId),
		});

		return {
			data: rows.map(({ userId, botId, ...row }) => ({
				...row,
				user: identities.person(userId),
				bot: identities.bot(botId),
			})),
			rowCount: rowCount.count,
		};
	});

const createQuotaPool = authed.quotaPool.create
	.use(requireOrganizationPermission("manage_quota_pools"))
	.effect(function* ({ input, context }) {
		const organizationId = context.auth.session.activeOrganizationId;
		const created = yield* createQuotaPoolCommand({
			organizationId,
			name: input.name,
			description: input.description,
			providerId: input.providerId,
			modelId: input.modelId,
			periodType: input.periodType,
			budgetAmount: input.budgetAmount,
			priority: input.priority,
			isDefault: input.isDefault,
			isActive: input.isActive,
			createdByUserId: context.auth.user.id,
			groupIds: input.groupIds,
		});

		if (created.status !== "ok") {
			return yield* Effect.fail(quotaPoolWriteError(created.status));
		}

		return {
			data: created.pool,
		};
	});

const updateQuotaPool = authed.quotaPool.update
	.use(requireOrganizationPermission("manage_quota_pools"))
	.effect(function* ({ input, context }) {
		const organizationId = context.auth.session.activeOrganizationId;
		const updated = yield* updateQuotaPoolCommand({
			organizationId,
			actorUserId: context.auth.user.id,
			...input,
		});

		if (updated.status !== "ok") {
			return yield* Effect.fail(quotaPoolWriteError(updated.status));
		}

		return {
			data: updated.pool,
		};
	});

const deactivateQuotaPool = authed.quotaPool.deactivate
	.use(requireOrganizationPermission("manage_quota_pools"))
	.effect(function* ({ input, context }) {
		const organizationId = context.auth.session.activeOrganizationId;
		const deactivated = yield* deactivateQuotaPoolCommand({
			organizationId,
			actorUserId: context.auth.user.id,
			id: input.id,
		});

		if (deactivated.status !== "ok") {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "QUOTA_POOL_NOT_FOUND",
					message: "Quota pool not found",
				}),
			);
		}

		return {
			data: deactivated.pool,
		};
	});

export const quotaPoolRouter = {
	list: listQuotaPools,
	create: createQuotaPool,
	find: findQuotaPool,
	listEvents: listQuotaUsageEvents,
	update: updateQuotaPool,
	deactivate: deactivateQuotaPool,
};
