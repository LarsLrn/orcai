import type { OrganizationId, ProviderId, QuotaPoolId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	createQuotaPool as createQuotaPoolCommand,
	deactivateQuotaPool as deactivateQuotaPoolCommand,
	resolveQuotaPool,
	updateQuotaPool as updateQuotaPoolCommand,
	type WriteQuotaPoolResult,
} from "@orcai/quota";
import type { QuotaPoolSortKey } from "@orcai/schema";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	requireEntityPermission,
	requireOrganizationPermission,
} from "@/lib/orpc/middlewares/permission";
import { literalSearch } from "./helpers/literal-search";
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

const listQuotaPools = authed.quota.list
	.use(requireOrganizationPermission("read"))
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

const findQuotaPool = authed.quota.find
	.use(requireOrganizationPermission("read"))
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

		const [state, assignments, recentEvents] = yield* Effect.all(
			[
				getCurrentPeriodAndLedger({
					quotaPoolId: row.pool.id,
				}),
				db.query.quotaPoolGroupAssignment.findMany({
					where: {
						AND: [
							{
								quotaPoolId: {
									eq: row.pool.id,
								},
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
						quotaPoolId: {
							eq: row.pool.id,
						},
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
	});

const createQuotaPool = authed.quota.create
	.use(requireOrganizationPermission("manage_quotas"))
	.effect(function* ({ input, context }) {
		const organizationId = context.auth.session.activeOrganizationId;
		const created = yield* createQuotaPoolCommand({
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
			groupIds: input.groupIds,
		});

		if (created.status !== "ok") {
			return yield* Effect.fail(quotaPoolWriteError(created.status));
		}

		return {
			data: created.pool,
		};
	});

const updateQuotaPool = authed.quota.update
	.use(requireOrganizationPermission("manage_quotas"))
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

const deactivateQuotaPool = authed.quota.deactivate
	.use(requireOrganizationPermission("manage_quotas"))
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

/** The organisation's assistant model in the shape of a chat config, empty when unset. */
const assistantModelConfig = (organizationId: OrganizationId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [row] = yield* db
			.select({
				providerId: dbSchema.model.providerId,
				modelId: dbSchema.model.id,
			})
			.from(dbSchema.organization)
			.innerJoin(
				dbSchema.model,
				eq(dbSchema.model.id, dbSchema.organization.assistantModelId),
			)
			.where(eq(dbSchema.organization.id, organizationId))
			.limit(1);

		return {
			providerId: row?.providerId,
			modelId: row?.modelId,
		};
	});

// TODO: Consider restricting pool budget/usage data to admin users.
// Currently any user with chat-read access can see pool budget details.
const quotaChatBadge = authed.quota.chatBadge
	.use(
		requireEntityPermission("chat", "read", {
			entityId: "chatId",
		}),
	)
	.effect(function* ({ input, context }) {
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
				id: {
					eq: input.chatId,
				},
			},
			columns: {
				botId: true,
				config: true,
				kind: true,
			},
		});

		const chatConfig =
			chat?.kind === "assistant"
				? yield* assistantModelConfig(organizationId)
				: ((chat?.config ?? {}) as {
						providerId?: ProviderId;
						modelId?: string;
					});

		if (chatConfig.providerId && chatConfig.modelId) {
			const resolved = yield* resolveQuotaPool({
				organizationId,
				userId: context.auth.user.id,
				providerId: chatConfig.providerId,
				providerModelId: chatConfig.modelId,
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
		}

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
			provider?: ProviderId;
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
			organizationId: organizationId,
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
	});

const quotaAvailability = authed.quota.availability
	.use(requireOrganizationPermission("read"))
	.effect(function* ({ input, context }) {
		const resolved = yield* resolveQuotaPool({
			organizationId: context.auth.session.activeOrganizationId,
			userId: context.auth.user.id,
			providerId: input.providerId,
			providerModelId: input.modelId,
		});

		return {
			data: {
				available: resolved.winningPool !== null,
			},
		};
	});

export const quotaRouter = {
	list: listQuotaPools,
	create: createQuotaPool,
	find: findQuotaPool,
	update: updateQuotaPool,
	deactivate: deactivateQuotaPool,
	chatBadge: quotaChatBadge,
	availability: quotaAvailability,
};
