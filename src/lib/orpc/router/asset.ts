import { getLogger } from "@orpc/experimental-pino";
import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, getColumns, inArray } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { assetTable } from "@/db/schema/asset";
import { authed } from "@/lib/orpc/implementation/authed";
import {
	type CheckManyPermissionInput,
	type CheckPermissionInput,
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import {
	deleteFileFromBucket,
	deletePrefixRecursively,
} from "@/lib/s3/file-functions";
import type { FileType } from "@/lib/s3/schema/file-schema";
import { createRelation, listAllowedEntities } from "@/lib/spice-db/actions";
import { deletePointsByIdentifier } from "@/qdrant/mutations";
import { buckets } from "@/settings/buckets";

export const listAssets = authed.asset.list.handler(
	async ({ input, context }) => {
		const { entityIds } = await listAllowedEntities({
			userId: context.auth.user.id,
			action: "read",
			entityType: "asset",
		});

		const whereConditions = [inArray(assetTable.id, entityIds)];
		if (input.filters?.ids) {
			whereConditions.push(inArray(assetTable.id, input.filters.ids));
		}

		const [data, [rowCount]] = await Promise.all([
			db
				.select({ ...getColumns(assetTable) })
				.from(assetTable)
				.where(and(...whereConditions))
				.orderBy(desc(assetTable.createdAt))
				.limit(input.pageSize)
				.offset(input.pageIndex * input.pageSize),
			db
				.select({ count: count() })
				.from(assetTable)
				.where(and(...whereConditions)),
		]);

		return { data, rowCount: rowCount.count };
	},
);

export const findAsset = authed.asset.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "asset",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) => {
		const [query] = await db
			.select({ ...getColumns(assetTable) })
			.from(assetTable)
			.where(eq(assetTable.id, input.id));

		if (!query) {
			throw new ORPCError("NOT_FOUND", { message: "Asset not found" });
		}

		return { data: query };
	});

export const createAsset = authed.asset.create.handler(
	async ({ input, context }) => {
		const [asset] = await db
			.insert(assetTable)
			.values({
				id: input.id, // TODO: This shouldnt come from the client, but needs to match the S3 file ID. Think of a solution to this
				title: input.title ?? "New Asset",
				size: input.size,
				fileType: input.fileType,
				bucket: buckets.main.name,
				prefix: "placeholder", // TODO: Make this dynamic
				userId: context.auth.user.id,
			})
			.returning({ ...getColumns(assetTable) });

		await createRelation({
			entityId: asset.id,
			entityType: "asset",
			userId: context.auth.user.id,
			relation: "owner",
		});

		return asset;
	},
);

export const updateAsset = authed.asset.update
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "asset",
			}) satisfies CheckPermissionInput,
	)
	.handler(async ({ input }) => {
		const [asset] = await db
			.update(assetTable)
			.set({
				title: input.title,
				updatedAt: new Date(),
			})
			.where(eq(assetTable.id, input.id))
			.returning({ ...getColumns(assetTable) });

		return { data: asset };
	});

export const deleteAssets = authed.asset.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				action: "delete",
				entityType: "asset",
			}) satisfies CheckManyPermissionInput,
	)
	.handler(async ({ context }) => {
		const logger = getLogger(context);

		// Check if there are any IDs to delete
		if (!context.allowedIds || context.allowedIds.length === 0) {
			return { success: true, message: "No assets to delete" };
		}

		try {
			const assetsToDelete = await db
				.select()
				.from(assetTable)
				.where(inArray(assetTable.id, context.allowedIds));

			await Promise.all(
				assetsToDelete.map(async (asset) => {
					await deleteFileFromBucket({
						bucket: asset.bucket,
						id: asset.id,
						prefix: asset.prefix,
						type: asset.fileType as FileType,
					});
					await deletePointsByIdentifier({
						assetId: asset.id,
						blockId: undefined,
					});
					await deletePrefixRecursively({
						bucket: buckets.processed.name,
						prefix: `${asset.id}/`,
					});
				}),
			);

			await db
				.delete(assetTable)
				.where(inArray(assetTable.id, context.allowedIds));

			return { success: true, message: "Assets deleted successfully" };
		} catch (error) {
			logger?.error({ error }, "Error deleting assets:");
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete assets",
			});
		}
	});
