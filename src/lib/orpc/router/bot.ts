import { getLogger } from "@orpc/experimental-pino";
import { ORPCError } from "@orpc/server";
import { and, count, eq, getTableColumns, ilike, inArray } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { botBlockTable, botTable } from "@/db/schema/bot";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	type CheckManyPermissionInput,
	type CheckPermissionInput,
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import { createRelation, listAllowedEntities } from "@/lib/spice-db/actions";

export const listBots = authed.bot.list.handler(async ({ input, context }) => {
	const { entityIds } = await listAllowedEntities({
		entityType: "bot",
		action: "read",
		userId: context.auth.user.id,
	});

	const whereConditions = [inArray(botTable.id, entityIds)];
	if (input.search) {
		whereConditions.push(ilike(botTable.name, `%${input.search}%`));
	}

	const [data, [rowCount]] = await Promise.all([
		db
			.select({ ...getTableColumns(botTable) })
			.from(botTable)
			.where(and(...whereConditions))
			.limit(input.pageSize)
			.offset(input.pageIndex * input.pageSize),
		db
			.select({ count: count() })
			.from(botTable)
			.where(and(...whereConditions)),
	]);

	return { data, rowCount: rowCount.count };
});

export const findBot = authed.bot.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "bot",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) => {
		const [bot] = await db
			.select({ ...getTableColumns(botTable) })
			.from(botTable)
			.where(eq(botTable.id, input.id));

		if (!bot) {
			throw new ORPCError("NOT_FOUND", { message: "Bot not found" });
		}

		// Fetch the associated blockIds
		const blockIds = await db
			.select({ ...getTableColumns(botBlockTable) })
			.from(botBlockTable)
			.where(eq(botBlockTable.botId, bot.id));

		return { data: { ...bot, blockIds: blockIds.map((b) => b.blockId) } };
	});

export const createBot = authed.bot.create
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) => {
		const [bot] = await db
			.insert(botTable)
			.values({
				...input,
				userId: context.auth.user.id,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning({ ...getTableColumns(botTable) });

		const botBlocks = await db
			.insert(botBlockTable)
			.values(
				input.blockIds.map((blockId) => ({
					blockId,
					botId: bot.id,
					createdAt: new Date(),
				})),
			)
			.returning({ ...getTableColumns(botBlockTable) });

		await createRelation({
			entityId: bot.id,
			entityType: "bot",
			userId: context.auth.user.id,
			relation: "owner",
		});

		return { data: { ...bot, blockIds: botBlocks.map((bb) => bb.blockId) } };
	});

export const updateBot = authed.bot.update
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "bot",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) => {
		const [bot] = await db
			.update(botTable)
			.set({
				...input,
				updatedAt: new Date(),
			})
			.where(eq(botTable.id, input.id))
			.returning({ ...getTableColumns(botTable) });

		// Remove all existing bot-block relationships
		// TODO: Handle this more elegantly rather then deleting and recreating
		await db.delete(botBlockTable).where(eq(botBlockTable.botId, bot.id));

		const botBlocks = await db
			.insert(botBlockTable)
			.values(
				input.blockIds.map((blockId) => ({
					blockId,
					botId: bot.id,
					createdAt: new Date(),
				})),
			)
			.returning({ ...getTableColumns(botBlockTable) });

		return { data: { ...bot, blockIds: botBlocks.map((bb) => bb.blockId) } };
	});

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
	.handler(async ({ context }) => {
		const logger = getLogger(context);
		logger?.info({ ids: context.allowedIds }, "Deleting bots by IDs");

		// Check if there are any IDs to delete
		if (!context.allowedIds || context.allowedIds.length === 0) {
			return { success: true, message: "No bots to delete" };
		}

		try {
			await db.delete(botTable).where(inArray(botTable.id, context.allowedIds));

			return { success: true, message: "Bots deleted successfully" };
		} catch (error) {
			logger?.error({ error }, "Error deleting bots:");
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete bots",
			});
		}
	});
