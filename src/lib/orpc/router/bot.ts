import { and, count, eq, getColumns, ilike, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { calculateRelationDelta } from "@/lib/authz/relation-delta";
import { initializeResourceAuthorization } from "@/lib/authz/resource-lifecycle";
import { AuthzService } from "@/lib/effect/services/authz";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/org-permission";
import {
	type CheckManyPermissionInput,
	type CheckPermissionInput,
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import { lookupEntitiesByPermission } from "@/lib/spice-db/client";

export const listBots = authed.bot.list.handler(async ({ input, context }) =>
	runOrpcEffect(
		Effect.gen(function* () {
			const db = yield* DB;

			const allowedIds = yield* lookupEntitiesByPermission({
				userId: context.auth.user.id,
				permission: "read",
				entityType: "bot",
				zedToken: input.zedToken,
			}).pipe(
				Effect.map((response) => response.map((item) => item.resourceObjectId)),
			);

			const whereConditions = [
				inArray(dbSchema.bot.id, allowedIds),
			];
			if (input.search) {
				whereConditions.push(ilike(dbSchema.bot.name, `%${input.search}%`));
			}

			return yield* Effect.all(
				[
					db
						.select({
							...getColumns(dbSchema.bot),
						})
						.from(dbSchema.bot)
						.where(and(...whereConditions))
						.limit(input.pageSize)
						.offset(input.pageIndex * input.pageSize),
					db
						.select({
							count: count(),
						})
						.from(dbSchema.bot)
						.where(and(...whereConditions)),
				],
				{
					concurrency: "unbounded",
				},
			).pipe(
				Effect.map(([data, [countResult]]) => ({
					data,
					rowCount: countResult.count,
				})),
			);
		}),
	),
);

export const findBot = authed.bot.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				permission: "read",
				entityType: "bot",
				zedToken: input.zedToken,
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [bot] = yield* db
					.select({
						...getColumns(dbSchema.bot),
					})
					.from(dbSchema.bot)
					.where(eq(dbSchema.bot.id, input.id));

				if (!bot) {
					return yield* Effect.fail(
						errors.NOT_FOUND({
							message: "Bot not found",
						}),
					);
				}

				const blockIds = yield* db
					.select({
						...getColumns(dbSchema.botBlock),
					})
					.from(dbSchema.botBlock)
					.where(eq(dbSchema.botBlock.botId, bot.id));

				return {
					data: {
						...bot,
						blockIds: blockIds.map((b) => b.blockId),
					},
				};
			}),
		),
	);

export const createBot = authed.bot.create
	.use(requireOrganizationPermission("create_bot"))
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const authz = yield* AuthzService;

				const [bot] = yield* db
					.insert(dbSchema.bot)
					.values({
						...input,
						userId: context.auth.user.id,
						createdAt: new Date(),
						updatedAt: new Date(),
					})
					.returning({
						...getColumns(dbSchema.bot),
					});

				const botBlocks = yield* db
					.insert(dbSchema.botBlock)
					.values(
						input.blockIds.map((blockId) => ({
							blockId,
							botId: bot.id,
							createdAt: new Date(),
						})),
					)
					.returning({
						...getColumns(dbSchema.botBlock),
					});

				let zedToken = (yield* initializeResourceAuthorization({
					resourceType: "bot",
					resourceId: bot.id,
					organizationId: context.auth.session.activeOrganizationId,
					ownerUserId: context.auth.user.id,
				})).zedToken;

				if (input.blockIds.length > 0) {
					const relationResult = yield* authz.applyRelationshipMutations({
						mutations: input.blockIds.map((blockId) => ({
							resourceType: "block" as const,
							resourceId: blockId,
							relation: "bot" as const,
							subjectType: "bot" as const,
							subjectId: bot.id,
							operation: "touch" as const,
						})),
					});
					zedToken = relationResult.zedToken ?? zedToken;
				}

				return {
					data: {
						...bot,
						blockIds: botBlocks.map((bb) => bb.blockId),
					},
					meta: {
						zedToken,
					},
				};
			}),
		),
	);

export const updateBot = authed.bot.update
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				permission: "edit",
				entityType: "bot",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const authz = yield* AuthzService;

				const previousBlocks = yield* db
					.select({
						blockId: dbSchema.botBlock.blockId,
					})
					.from(dbSchema.botBlock)
					.where(eq(dbSchema.botBlock.botId, input.id));

				const [bot] = yield* db
					.update(dbSchema.bot)
					.set({
						...input,
						updatedAt: new Date(),
					})
					.where(eq(dbSchema.bot.id, input.id))
					.returning({
						...getColumns(dbSchema.bot),
					});

				yield* db
					.delete(dbSchema.botBlock)
					.where(eq(dbSchema.botBlock.botId, bot.id));

				const botBlocks = yield* db
					.insert(dbSchema.botBlock)
					.values(
						input.blockIds.map((blockId) => ({
							blockId,
							botId: bot.id,
							createdAt: new Date(),
						})),
					)
					.returning({
						...getColumns(dbSchema.botBlock),
					});

				const { removedIds, addedIds } = calculateRelationDelta(
					previousBlocks.map((block) => block.blockId),
					input.blockIds,
				);

				if (removedIds.length > 0 || addedIds.length > 0) {
					yield* authz.applyRelationshipMutations({
						mutations: [
							...removedIds.map((blockId) => ({
								resourceType: "block" as const,
								resourceId: blockId,
								relation: "bot" as const,
								subjectType: "bot" as const,
								subjectId: bot.id,
								operation: "delete" as const,
							})),
							...addedIds.map((blockId) => ({
								resourceType: "block" as const,
								resourceId: blockId,
								relation: "bot" as const,
								subjectType: "bot" as const,
								subjectId: bot.id,
								operation: "touch" as const,
							})),
						],
					});
				}

				return {
					data: {
						...bot,
						blockIds: botBlocks.map((bb) => bb.blockId),
					},
				};
			}),
		),
	);

export const deleteBots = authed.bot.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				permission: "delete",
				entityType: "bot",
			}) satisfies CheckManyPermissionInput,
	)
	.handler(async ({ context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				if (!context.allowedIds || context.allowedIds.length === 0) {
					return {
						success: true,
						message: "No bots to delete",
					};
				}

				yield* db
					.delete(dbSchema.bot)
					.where(inArray(dbSchema.bot.id, context.allowedIds));

				return {
					success: true,
					message: "Bots deleted successfully",
				};
			}),
		),
	);
