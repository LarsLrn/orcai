import { auth, batch, tasks } from "@trigger.dev/sdk";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { assetTable } from "@/db/schema/asset";
import { blockAssetTable } from "@/db/schema/block";
import { taskTable } from "@/db/schema/task";
import { authed } from "@/lib/orpc/implementation/authed";
import { os } from "@/lib/orpc/implementation/base";
import { client } from "@/lib/orpc/orpc";
import { getFileTypeFromMime } from "@/lib/s3/upload-helpers";
import { processAssetTask } from "@/trigger/process-asset-task";

export const listTasks = authed.task.list.handler(async ({ input }) => {
	const whereConditions = [eq(taskTable.resourceId, input.resourceId)];

	const [data, [rowCount]] = await Promise.all([
		db
			.select()
			.from(taskTable)
			.where(and(...whereConditions)),
		db
			.select({ count: count() })
			.from(taskTable)
			.where(and(...whereConditions)),
	]);

	return { data, rowCount: rowCount.count };
});

export const createTask = os.task.create.handler(async ({ input }) => {
	const [task] = await db
		.insert(taskTable)
		.values({
			...input,
			status: "queued",
		})
		.returning();

	return { data: task };
});

export const updateTask = os.task.update.handler(async ({ input }) => {
	const [task] = await db
		.update(taskTable)
		.set({
			...input,
		})
		.where(eq(taskTable.runId, input.runId))
		.returning();

	return { data: task };
});

export const createDatabaseBlockVectorStore =
	authed.task.createDatabaseBlockVectorStore.handler(async ({ input }) => {
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

				const handle = await tasks.batchTrigger<typeof processAssetTask>(
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
					})),
				);

				const batchDetails = await batch.retrieve(handle.batchId);
				const publicAccessToken = await auth.createPublicToken({
					scopes: {
						read: {
							runs: batchDetails.runs,
						},
					},
				});
				await Promise.all(
					batchDetails.runs.map(async (run) => {
						await client.task.create({
							resourceId: input.blockId,
							resourceType: "block",
							task: processAssetTask.id,
							runId: run,
							publicAccessToken,
						});
					}),
				);

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
