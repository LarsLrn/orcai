import { ORPCError } from "@orpc/client";
import { tasks } from "@trigger.dev/sdk/v3";
import { inArray } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { document } from "@/db/schema/document";
import { authed } from "@/lib/orpc";
import { retry } from "@/lib/orpc/middlewares/retry";
import type { processDocumentTask } from "@/trigger/process-document-task";
import type { vectorizeFilesTask } from "@/trigger/vectorize-files-task";
import type { FilePayload } from "@/types/file";

export const createDocumentTask = authed.task.createDocumentTask
	.use(retry({ times: 3 }))
	.handler(async ({ input, context }) => {
		const activeCourseId = context.session.session.activeCourseId;

		if (!activeCourseId) {
			throw new ORPCError("BAD_REQUEST", { message: "No active course found" });
		}

		switch (input.taskType) {
			case "extract": {
				await db
					.update(document)
					.set({ status: "processing-document", updatedAt: new Date() })
					.where(inArray(document.id, input.ids));

				const docs = await db
					.select({
						id: document.id,
						bucket: document.bucket,
						type: document.fileType,
						prefix: document.prefix,
						metadata: document.metadata,
					})
					.from(document)
					.where(inArray(document.id, input.ids));

				const _handle = await tasks.batchTrigger<typeof processDocumentTask>(
					"process-document-task",
					docs.map((doc) => ({
						payload: {
							courseId: activeCourseId,
							documentRef: doc as FilePayload,
							mergePages: doc.metadata.mergePages ?? true,
						},
						options: {
							concurrencyKey: "PROCESSING_DOCUMENT_CONCURRENCY_KEY",
							queue: {
								name: "processing-documents-queue",
								concurrencyLimit: 1,
							},
						},
					})),
				);

				return {
					success: true,
					message: `Processing ${docs.length} documents`,
				};
			}
			case "embed": {
				await db
					.update(document)
					.set({ status: "generating-embedding", updatedAt: new Date() })
					.where(inArray(document.id, input.ids));

				const docs = await db
					.select({
						id: document.id,
						metadata: document.metadata,
					})
					.from(document)
					.where(inArray(document.id, input.ids));

				const _handle = await tasks.batchTrigger<typeof vectorizeFilesTask>(
					"vectorize-files-task",
					docs.map((doc) => ({
						payload: {
							prefix: doc.id,
							courseId: activeCourseId,
							documentId: doc.id,
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
