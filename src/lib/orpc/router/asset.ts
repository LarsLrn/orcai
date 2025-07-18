import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, getTableColumns, inArray } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { document } from "@/db/schema/document";
import { authed } from "@/lib/orpc";
import {
	checkManyPermissionMiddleware,
	checkPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import { retry } from "@/lib/orpc/middlewares/retry";
import {
	deleteFileFromBucket,
	deletePrefixRecursively,
} from "@/lib/s3/file-functions";
import { createRelation, listAllowedEntities } from "@/lib/spice-db/actions";
import { deleteChunksByDocumentId } from "@/qdrant/mutations";
import { buckets } from "@/settings/buckets";
import type { FileType } from "@/types/file";

export const listAssets = authed.asset.list
	.use(retry({ times: 3 }))
	.handler(async ({ input, context }) => {
		const { entityIds } = await listAllowedEntities({
			userId: context.auth.user.id,
			action: "read",
			entityType: "asset",
		});

		const query = await db
			.select({ ...getTableColumns(document) })
			.from(document)
			.where(
				and(
					inArray(document.id, entityIds),
					eq(document.courseId, input.courseId),
				),
			)
			.orderBy(desc(document.createdAt))
			.limit(input.pageSize)
			.offset(input.pageIndex * input.pageSize);

		const [rowCount] = await db
			.select({ count: count() })
			.from(document)
			.where(inArray(document.id, entityIds));

		return { data: query, rowCount: rowCount.count };
	});

export const findAsset = authed.asset.find
	.use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "asset",
			}) as const,
	)
	.use(retry({ times: 3 }))
	.handler(async ({ input }) => {
		const [query] = await db
			.select({ ...getTableColumns(document) })
			.from(document)
			.where(eq(document.id, input.id));

		if (!query) {
			throw new ORPCError("NOT_FOUND", { message: "Document not found" });
		}

		return { data: query };
	});

export const createAsset = authed.asset.create.handler(
	async ({ input, context }) => {
		const [query] = await db
			.insert(document)
			.values({
				id: input.id, // TODO: This shouldnt come from the client, but needs to match the S3 file ID. Think of a solution to this
				title: input.title ?? "New Document",
				courseId: input.courseId,
				size: input.size,
				fileType: input.fileType,
				bucket: buckets.main.name,
				prefix: input.courseId, // TODO: Should not necessarily based on courseId
				uploadedBy: context.auth.user.id,
			})
			.returning({ ...getTableColumns(document) });

		await createRelation({
			entityId: query.id,
			entityType: "asset",
			userId: context.auth.user.id,
			relation: "owner",
		});

		return query;
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
			}) as const,
	)
	.handler(async ({ input }) => {
		const [query] = await db
			.update(document)
			.set({
				title: input.title,
				updatedAt: new Date(),
			})
			.where(eq(document.id, input.id))
			.returning({ ...getTableColumns(document) });

		return { data: query };
	});

export const deleteAssets = authed.asset.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				action: "delete",
				entityType: "asset",
			}) as const,
	)
	.handler(async ({ context }) => {
		console.log("Deleting assets with allowed IDs:", context.allowedIds);

		// Check if there are any IDs to delete
		if (!context.allowedIds || context.allowedIds.length === 0) {
			return { success: true, message: "No assets to delete" };
		}

		try {
			const filesToDelete = await db
				.select()
				.from(document)
				.where(inArray(document.id, context.allowedIds));

			Promise.all(
				filesToDelete.map(async (file) => {
					await deleteFileFromBucket({
						bucket: file.bucket,
						id: file.id,
						prefix: file.prefix,
						type: file.fileType as FileType,
					});
					await deleteChunksByDocumentId({
						courseId: file.courseId,
						documentId: file.id,
					});
					await deletePrefixRecursively({
						bucket: buckets.processed.name,
						prefix: `${file.id}/`,
					});
				}),
			);

			await db.delete(document).where(inArray(document.id, context.allowedIds));

			return { success: true, message: "Assets deleted successfully" };
		} catch (error) {
			console.error("Error deleting assets:", error);
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete assets",
			});
		}
	});
