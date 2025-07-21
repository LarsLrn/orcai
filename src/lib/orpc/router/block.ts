import { ORPCError } from "@orpc/server";
import { count, eq, getTableColumns, inArray } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { blockTable } from "@/db/schema/block";
import { authed } from "@/lib/orpc";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import { retry } from "@/lib/orpc/middlewares/retry";
import { createRelation, listAllowedEntities } from "@/lib/spice-db/actions";

export const listBlocks = authed.block.list
	.use(retry({ times: 3 }))
	.handler(async ({ input, context }) => {
		const { entityIds } = await listAllowedEntities({
			entityType: "block",
			action: "read",
			userId: context.auth.user.id,
		});

		const query = await db
			.select({ ...getTableColumns(blockTable) })
			.from(blockTable)
			.where(inArray(blockTable.id, entityIds))
			.limit(input.pageSize)
			.offset(input.pageIndex * input.pageSize);

		const [rowCount] = await db.select({ count: count() }).from(blockTable);

		return { data: query, rowCount: rowCount.count };
	});

export const findBlock = authed.block.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "block",
			}) as const,
	)
	.use(retry({ times: 3 }))
	.handler(async ({ input }) => {
		const [query] = await db
			.select({ ...getTableColumns(blockTable) })
			.from(blockTable)
			.where(eq(blockTable.id, input.id));

		if (!query) {
			throw new ORPCError("NOT_FOUND", { message: "Block not found" });
		}

		return { data: query };
	});

export const createBlock = authed.block.create
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) => {
		const [query] = await db
			.insert(blockTable)
			.values({
				...input,
				userId: context.auth.user.id,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning({ ...getTableColumns(blockTable) });

		await createRelation({
			entityId: query.id,
			entityType: "block",
			userId: context.auth.user.id,
			relation: "owner",
		});

		return { data: query };
	});

export const updateBlock = authed.block.update
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "block",
			}) as const,
	)
	.handler(async ({ input }) => {
		const [query] = await db
			.update(blockTable)
			.set({
				...input,
				updatedAt: new Date(),
			})
			.where(eq(blockTable.id, input.id))
			.returning({ ...getTableColumns(blockTable) });

		return { data: query };
	});

export const deleteBlocks = authed.block.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				action: "delete",
				entityType: "block",
			}) as const,
	)
	.handler(async ({ context }) => {
		console.log("Deleting blocks with allowed IDs:", context.allowedIds);

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
			console.error("Error deleting blocks:", error);
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete blocks",
			});
		}
	});
