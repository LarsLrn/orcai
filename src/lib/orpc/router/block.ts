import { getLogger } from "@orpc/experimental-pino";
import { ORPCError } from "@orpc/server";
import {
	and,
	countDistinct,
	desc,
	eq,
	getTableColumns,
	inArray,
} from "drizzle-orm";
import { db } from "@/db/drizzle";
import { blockAssetTable, blockTable } from "@/db/schema/block";
import { botBlockTable } from "@/db/schema/bot";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	type CheckManyPermissionInput,
	type CheckPermissionInput,
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import type { Block } from "@/lib/orpc/schemas/block";
import { createRelation, listAllowedEntities } from "@/lib/spice-db/actions";

export const listBlocks = authed.block.list.handler(
	async ({ input, context }) => {
		const { entityIds } = await listAllowedEntities({
			entityType: "block",
			action: "read",
			userId: context.auth.user.id,
		});

		const whereConditions = [inArray(blockTable.id, entityIds)];
		if (input.filters?.botId) {
			whereConditions.push(eq(botBlockTable.botId, input.filters.botId));
		}

		const [data, [rowCount]] = await Promise.all([
			db
				.selectDistinctOn([blockTable.id, blockTable.createdAt], {
					...getTableColumns(blockTable),
				})
				.from(blockTable)
				.leftJoin(botBlockTable, eq(botBlockTable.blockId, blockTable.id))
				.where(and(...whereConditions))
				.orderBy(desc(blockTable.createdAt))
				.limit(input.pageSize)
				.offset(input.pageIndex * input.pageSize) as Promise<Block[]>,
			db
				.select({
					count: countDistinct(blockTable.id),
				})
				.from(blockTable)
				.leftJoin(botBlockTable, eq(botBlockTable.blockId, blockTable.id))
				.where(and(...whereConditions)),
		]);

		return { data, rowCount: rowCount.count };
	},
);

export const findBlock = authed.block.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "block",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) => {
		const [block] = (await db
			.select({ ...getTableColumns(blockTable) })
			.from(blockTable)
			.where(eq(blockTable.id, input.id))) as Block[];

		if (!block) {
			throw new ORPCError("NOT_FOUND", { message: "Block not found" });
		}

		if (block.type === "database") {
			const assets = await db
				.select({ assetId: blockAssetTable.assetId })
				.from(blockAssetTable)
				.where(eq(blockAssetTable.blockId, input.id));

			return { data: block, assets: assets.map((a) => a.assetId) };
		}

		return { data: block };
	});

export const createBlock = authed.block.create
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) => {
		const [block] = (await db
			.insert(blockTable)
			.values({
				...input,
				userId: context.auth.user.id,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning({ ...getTableColumns(blockTable) })) as Block[];

		await createRelation({
			entityId: block.id,
			entityType: "block",
			userId: context.auth.user.id,
			relation: "owner",
		});

		if (input.type === "database") {
			const assets = await db
				.insert(blockAssetTable)
				.values(
					input.assets.map((assetId) => ({
						blockId: block.id,
						assetId,
					})),
				)
				.returning({ assetId: blockAssetTable.assetId });

			return { data: block, assets: assets.map((a) => a.assetId) };
		}

		return { data: block };
	});

export const updateBlock = authed.block.update
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "block",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) => {
		const [block] = (await db
			.update(blockTable)
			.set({
				...input,
				updatedAt: new Date(),
			})
			.where(eq(blockTable.id, input.id))
			.returning({ ...getTableColumns(blockTable) })) as Block[];

		if (input.type === "database" && block.type === "database") {
			await db
				.delete(blockAssetTable)
				.where(eq(blockAssetTable.blockId, block.id));

			const assets = await db
				.insert(blockAssetTable)
				.values(
					input.assets.map((assetId) => ({
						blockId: block.id,
						assetId,
					})),
				)
				.returning({ assetId: blockAssetTable.assetId });

			return { data: block, assets: assets.map((a) => a.assetId) };
		}

		return { data: block };
	});

export const deleteBlocks = authed.block.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				action: "delete",
				entityType: "block",
			}) satisfies CheckManyPermissionInput,
	)
	.handler(async ({ context }) => {
		const logger = getLogger(context);
		// Check if there are any IDs to delete
		if (!context.allowedIds || context.allowedIds.length === 0) {
			return { success: true, message: "No blocks to delete" };
		}

		try {
			await db
				.delete(blockTable)
				.where(inArray(blockTable.id, context.allowedIds));

			return { success: true, message: "Blocks deleted successfully" };
		} catch (error) {
			logger?.error({ error }, "Error deleting blocks:");
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete blocks",
			});
		}
	});
