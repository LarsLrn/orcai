import { getLogger } from "@orpc/experimental-pino";
import { and, count, eq, getColumns, ilike, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { botBlockTable, botTable } from "@/db/schema/bot";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	type CheckManyPermissionInput,
	type CheckPermissionInput,
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import { createRelation, listAllowedEntities } from "@/lib/spice-db/actions";

export const listBots = authed.bot.list.handler(async ({ input, context }) =>
	runOrpcEffect(
		Effect.gen(function* () {
			const db = yield* DB;

			const allowedIds = yield* listAllowedEntities({
				userId: context.auth.user.id,
				action: "read",
				entityType: "bot",
				zedToken: input.zedToken,
			}).pipe(
				Effect.map((response) => response.map((item) => item.resourceObjectId)),
			);

			const whereConditions = [inArray(botTable.id, allowedIds)];
			if (input.search) {
				whereConditions.push(ilike(botTable.name, `%${input.search}%`));
			}

			return yield* Effect.all(
				[
					db
						.select({ ...getColumns(botTable) })
						.from(botTable)
						.where(and(...whereConditions))
						.limit(input.pageSize)
						.offset(input.pageIndex * input.pageSize),
					db
						.select({ count: count() })
						.from(botTable)
						.where(and(...whereConditions)),
				],
				{ concurrency: "unbounded" },
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
				action: "read",
				entityType: "bot",
				zedToken: input.zedToken,
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [bot] = yield* db
					.select({ ...getColumns(botTable) })
					.from(botTable)
					.where(eq(botTable.id, input.id));

				if (!bot) {
					return yield* Effect.fail(
						errors.NOT_FOUND({ message: "Bot not found" }),
					);
				}

				// Fetch the associated blockIds
				const blockIds = yield* db
					.select({ ...getColumns(botBlockTable) })
					.from(botBlockTable)
					.where(eq(botBlockTable.botId, bot.id));

				return { data: { ...bot, blockIds: blockIds.map((b) => b.blockId) } };
			}),
		),
	);

export const createBot = authed.bot.create
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [bot] = yield* db
					.insert(botTable)
					.values({
						...input,
						userId: context.auth.user.id,
						createdAt: new Date(),
						updatedAt: new Date(),
					})
					.returning({ ...getColumns(botTable) });

				const botBlocks = yield* db
					.insert(botBlockTable)
					.values(
						input.blockIds.map((blockId) => ({
							blockId,
							botId: bot.id,
							createdAt: new Date(),
						})),
					)
					.returning({ ...getColumns(botBlockTable) });

				const relationResult = yield* createRelation({
					entityId: bot.id,
					entityType: "bot",
					userId: context.auth.user.id,
					relation: "owner",
				});

				return {
					data: { ...bot, blockIds: botBlocks.map((bb) => bb.blockId) },
					meta: { zedToken: relationResult.zedToken },
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
				action: "update",
				entityType: "bot",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [bot] = yield* db
					.update(botTable)
					.set({
						...input,
						updatedAt: new Date(),
					})
					.where(eq(botTable.id, input.id))
					.returning({ ...getColumns(botTable) });

				// Remove all existing bot-block relationships
				// TODO: Handle this more elegantly rather then deleting and recreating
				yield* db.delete(botBlockTable).where(eq(botBlockTable.botId, bot.id));

				const botBlocks = yield* db
					.insert(botBlockTable)
					.values(
						input.blockIds.map((blockId) => ({
							blockId,
							botId: bot.id,
							createdAt: new Date(),
						})),
					)
					.returning({ ...getColumns(botBlockTable) });

				return {
					data: { ...bot, blockIds: botBlocks.map((bb) => bb.blockId) },
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
				action: "delete",
				entityType: "bot",
			}) satisfies CheckManyPermissionInput,
	)
	.handler(async ({ context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;
				const logger = getLogger(context);
				logger?.info({ ids: context.allowedIds }, "Deleting bots by IDs");

				// Check if there are any IDs to delete
				if (!context.allowedIds || context.allowedIds.length === 0) {
					return { success: true, message: "No bots to delete" };
				}

				yield* db
					.delete(botTable)
					.where(inArray(botTable.id, context.allowedIds));

				return { success: true, message: "Bots deleted successfully" };
			}),
		),
	);
