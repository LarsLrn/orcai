import type { ProviderId, QuotaPoolId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	createQuotaPool as createQuotaPoolCommand,
	deactivateQuotaPool as deactivateQuotaPoolCommand,
	resolveQuotaPool,
	updateQuotaPool as updateQuotaPoolCommand,
} from "@orcai/quota";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	requireEntityPermission,
	requireOrganizationPermission,
} from "@/lib/orpc/middlewares/permission";

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
			}),
		),
	);

export const createQuotaPool = authed.quota.create
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
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
					return yield* Effect.fail(
						errors.BAD_REQUEST({
							message:
								created.status === "provider_not_found"
									? "Provider not found in active organization"
									: created.status === "model_invalid"
										? "Model does not belong to selected provider"
										: "One or more group assignments are invalid",
						}),
					);
				}

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
				const organizationId = context.auth.session.activeOrganizationId;
				const updated = yield* updateQuotaPoolCommand({
					organizationId,
					actorUserId: context.auth.user.id,
					...input,
				});

				if (updated.status !== "ok") {
					return yield* Effect.fail(
						updated.status === "pool_not_found"
							? errors.NOT_FOUND({
									message: "Quota pool not found",
								})
							: errors.BAD_REQUEST({
									message:
										updated.status === "model_invalid"
											? "Model does not belong to pool provider"
											: "One or more group assignments are invalid",
								}),
					);
				}

				return {
					data: updated.pool,
				};
			}),
		),
	);

export const deactivateQuotaPool = authed.quota.deactivate
	.use(requireOrganizationPermission("manage_members"))
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const organizationId = context.auth.session.activeOrganizationId;
				const deactivated = yield* deactivateQuotaPoolCommand({
					organizationId,
					actorUserId: context.auth.user.id,
					id: input.id,
				});

				if (deactivated.status !== "ok") {
					return yield* Effect.fail(
						errors.NOT_FOUND({
							message: "Quota pool not found",
						}),
					);
				}

				return {
					data: deactivated.pool,
				};
			}),
		),
	);

// TODO: Consider restricting pool budget/usage data to admin users.
// Currently any user with chat-read access can see pool budget details.
export const quotaChatBadge = authed.quota.chatBadge
	.use(
		requireEntityPermission("chat", "read", {
			entityId: "chatId",
		}),
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
						id: {
							eq: input.chatId,
						},
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
			}),
		),
	);
