import { tasks } from "@trigger.dev/sdk/v3";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { assetTable } from "@/db/schema/asset";
import { blockAssetTable } from "@/db/schema/block";
import { authed } from "@/lib/orpc";
import { retry } from "@/lib/orpc/middlewares/retry";
import { getFileTypeFromMime } from "@/lib/s3/upload-helpers";
import type { processAssetTask } from "@/trigger/process-asset-task";
import type { vectorizeAssetTask } from "@/trigger/vectorize-asset-task";
import type { FilePayload, FileType } from "@/types/file";

export const createAssetTask = authed.task.createAssetTask
	.use(retry({ times: 3 }))
	.handler(async ({ input }) => {
		switch (input.taskType) {
			case "extract": {
				const docs = await db
					.select({
						id: assetTable.id,
						bucket: assetTable.bucket,
						type: assetTable.fileType,
						prefix: assetTable.prefix,
						metadata: assetTable.metadata,
					})
					.from(assetTable)
					.where(inArray(assetTable.id, input.ids));

				const _handle = await tasks.batchTrigger<typeof processAssetTask>(
					"process-asset-task",
					docs.map((doc) => ({
						payload: {
							assetRef: doc as FilePayload,
							blockId: input.blockId,
							mergePages: doc.metadata.mergePages ?? true,
						},
						options: {
							concurrencyKey: "PROCESSING_ASSET_CONCURRENCY_KEY",
							queue: {
								name: "processing-assets-queue",
								concurrencyLimit: 1,
							},
						},
					})),
				);

				return {
					success: true,
					message: `Processing ${docs.length} assets`,
				};
			}
			case "embed": {
				const docs = await db
					.select({
						id: assetTable.id,
						metadata: assetTable.metadata,
					})
					.from(assetTable)
					.where(inArray(assetTable.id, input.ids));

				const _handle = await tasks.batchTrigger<typeof vectorizeAssetTask>(
					"vectorize-asset-task",
					docs.map((doc) => ({
						payload: {
							prefix: doc.id,
							assetId: doc.id,
							blockId: input.blockId,
							mergePages: doc.metadata.mergePages ?? true,
						},
						options: {
							concurrencyKey: "GENERATING_EMBEDDING_CONCURRENCY_KEY",
							queue: {
								name: "processing-embeddings-queue",
								concurrencyLimit: 2,
							},
						},
					})),
				);

				return {
					success: true,
					message: `Embedding ${docs.length} documents`,
				};
			}
			default:
				throw new Error("Invalid task type");
		}
	});

export const createDatabaseBlockVectorStore =
	authed.task.createDatabaseBlockVectorStore
		.use(retry({ times: 3 }))
		.handler(async ({ input }) => {
			console.log(
				"Creating vector store for block:",
				input.blockId,
				input.taskType,
			);

			switch (input.taskType) {
				case "extract": {
					const docs = await db
						.select({
							id: assetTable.id,
							bucket: assetTable.bucket,
							type: assetTable.fileType,
							prefix: assetTable.prefix,
							metadata: assetTable.metadata,
						})
						.from(blockAssetTable)
						.where(eq(blockAssetTable.blockId, input.blockId))
						.innerJoin(assetTable, eq(blockAssetTable.assetId, assetTable.id));

					const _handle = await tasks.batchTrigger<typeof processAssetTask>(
						"process-asset-task",
						docs.map((doc) => ({
							payload: {
								assetRef: {
									bucket: doc.bucket,
									prefix: doc.prefix,
									id: doc.id,
									type: getFileTypeFromMime(doc.type),
								},
								blockId: input.blockId,
								mergePages: doc.metadata.mergePages ?? true,
							},
							options: {
								concurrencyKey: "PROCESSING_ASSET_CONCURRENCY_KEY",
								queue: {
									name: "processing-assets-queue",
									concurrencyLimit: 1,
								},
							},
						})),
					);

					console.log("Processing assets for vector store creation:", _handle);

					return {
						success: true,
						message: `Processing ${docs.length} assets`,
					};
				}
				/* case "embed": {
					const docs = await db
						.select({
							id: assetTable.id,
							metadata: assetTable.metadata,
						})
						.from(assetTable)
						.where(inArray(assetTable.id, input.ids));

					const _handle = await tasks.batchTrigger<typeof vectorizeAssetTask>(
						"vectorize-asset-task",
						docs.map((doc) => ({
							payload: {
								prefix: doc.id,
								assetId: doc.id,
								mergePages: doc.metadata.mergePages ?? true,
							},
							options: {
								concurrencyKey: "GENERATING_EMBEDDING_CONCURRENCY_KEY",
								queue: {
									name: "processing-embeddings-queue",
									concurrencyLimit: 2,
								},
							},
						})),
					);

					return {
						success: true,
						message: `Embedding ${docs.length} documents`,
					};
				} */
				default:
					throw new Error("Invalid task type");
			}
		});
