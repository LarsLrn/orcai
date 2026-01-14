import { PutObjectCommand } from "@aws-sdk/client-s3";
import { logger, task } from "@trigger.dev/sdk";
import {
	type SerializedDocument,
	serializeDoclingDocument,
} from "@/lib/ai/docling-serialize";
import { serverEnv } from "@/lib/env/server";
import {
	createPresignedUrlToDownload,
	deletePrefixRecursively,
} from "@/lib/s3/file-functions";
import { s3Client } from "@/lib/s3/s3-client";
import { getFileTypeFromMime } from "@/lib/s3/upload-helpers";
import { buckets } from "@/settings/buckets";
import type { SaiaDoclingData } from "@/types/docling";
import type { ProcessAssetTaskPayload } from "@/types/trigger";
import { mutateTaskStatus } from "./utils/mutate-task-status";
import { validateImageResolution } from "./utils/validate-image-resolution";
import { vectorizeAssetTask } from "./vectorize-asset-task";

export const processAssetTask = task({
	id: "process-asset-task",
	maxDuration: 1200,
	queue: {
		name: "processing-assets-queue",
		concurrencyLimit: 4,
	},
	async onStart({ payload, ctx }) {
		await mutateTaskStatus({
			status: "processing",
			startedAt: new Date(),
			task: ctx.task.id,
			resourceId: payload.blockId,
			resourceType: "block",
			payload,
			runId: ctx.run.id,
		});
	},
	async onSuccess({ payload, ctx }) {
		await mutateTaskStatus({
			status: "completed",
			finishedAt: new Date(),
			task: ctx.task.id,
			resourceId: payload.blockId,
			resourceType: "block",
			payload,
			runId: ctx.run.id,
		});

		// Wait for 5 seconds before vectorizing the asset
		// TODO: This is a temporary workaround to ensure the file is fully processed
		await new Promise((resolve) => setTimeout(resolve, 5000));

		await vectorizeAssetTask.trigger({
			prefix: payload.assetRef.id,
			assetId: payload.assetRef.id,
			blockId: payload.blockId,
			mergePages: payload.mergePages,
		});
	},
	async onFailure({ payload, ctx, error }) {
		const errorMessage =
			error instanceof Error
				? error.message
				: typeof error === "string"
					? error
					: String(error);

		await mutateTaskStatus({
			status: "failed",
			finishedAt: new Date(),
			task: ctx.task.id,
			resourceId: payload.blockId,
			resourceType: "block",
			payload: { ...payload, error: errorMessage },
			runId: ctx.run.id,
		});
	},
	async onCancel({ payload, ctx }) {
		await mutateTaskStatus({
			status: "canceled",
			finishedAt: new Date(),
			task: ctx.task.id,
			resourceId: payload.blockId,
			resourceType: "block",
			payload,
			runId: ctx.run.id,
		});
	},
	run: async (payload: ProcessAssetTaskPayload) => {
		const doclingApi = `${serverEnv.OPENAI_COMPATIBLE_BASE_URL}/documents/convert`;

		const presignedUrl = await createPresignedUrlToDownload(payload.assetRef);

		// Download the file using the presigned URL
		const fileResponse = await logger.trace("download-file", async () => {
			try {
				return await fetch(presignedUrl);
			} catch (error) {
				logger.error(
					`Error downloading file: ${error instanceof Error ? error.message : String(error)}`,
				);
				throw error;
			}
		});

		if (!fileResponse.ok) {
			throw new Error(
				`Failed to download file: ${fileResponse.status} ${fileResponse.statusText}`,
			);
		}

		// Get the file content as a buffer
		const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

		const doclingResponse = await logger.trace("process-document", async () => {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(
					() => {
						controller.abort();
					},
					15 * 60 * 1000,
				); // 15 minutes timeout

				// Create FormData to properly send the file using Web FormData
				const formData = new FormData();
				const fileBlob = new Blob([fileBuffer]);
				formData.append(
					"document",
					fileBlob,
					`document.${payload.assetRef.id}`,
				);

				const params = new URLSearchParams({
					response_type: "json",
					extract_tables_as_images: "false",
				});

				// Use the signal from the controller in the fetch call
				const response = await fetch(`${doclingApi}?${params}`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${serverEnv.OPENAI_COMPATIBLE_API_KEY}`,
					},
					body: formData,
					signal: controller.signal, // Connect the AbortController
				});

				// Clear the timeout to prevent memory leaks
				clearTimeout(timeoutId);
				return response;
			} catch (error) {
				logger.error(
					`Docling API fetch error: ${error instanceof Error ? error.message : String(error)}`,
				);

				throw error;
			}
		});

		// Check if the response is successful
		if (!doclingResponse.ok) {
			throw new Error(
				`Docling API returned ${doclingResponse.status}: ${await doclingResponse.text()}`,
			);
		}

		// Parse the response properly
		let processedDocument: SaiaDoclingData;
		try {
			const responseText = await doclingResponse.text();

			processedDocument = JSON.parse(responseText) as SaiaDoclingData;
		} catch (error) {
			logger.error(
				`Failed to parse Docling API response: ${error instanceof Error ? error.message : String(error)}`,
			);
			throw error;
		}

		const json = processedDocument.json_data;

		const serializedDocling: SerializedDocument[] | undefined =
			serializeDoclingDocument(json, {
				keepImageRefs: true,
				mergePages: payload.mergePages,
			});

		await logger.trace("clear-prefix", async () => {
			await deletePrefixRecursively({
				bucket: buckets.processed.name,
				prefix: `${payload.assetRef.id}/`,
			});
		});

		await logger.trace("upload-pages", async () => {
			if (!serializedDocling || serializedDocling.length === 0) {
				logger.info("No serialized docling content to upload for markdown.");
				return;
			}

			await Promise.all(
				serializedDocling.map(async (page) => {
					await logger.trace(
						`Processing page ${page.page} of ${serializedDocling.length}`,
						async () => {
							logger.trace(
								`Uploading markdown from page ${page.page} of ${serializedDocling.length}`,
								async () => {
									const markdown = page.markdown;

									const command = new PutObjectCommand({
										Bucket: buckets.processed.name,
										Key: `${payload.assetRef.id}/page-${page.page}.md`,
										Body: Buffer.from(markdown, "utf-8"),
										ContentType: "text/markdown",
									});

									await s3Client.send(command);
								},
							);

							await logger.trace(
								`Uploading Images from page ${page.page} of ${serializedDocling.length}`,
								async () => {
									const images = page.images;

									await Promise.all(
										images.map(async (image) => {
											if (!image) {
												logger.warn("Undefined image. Skipping upload.");
												return;
											}

											logger.info(
												`Processing image ${image.label}-${image.index} (${image.mimetype})`,
											);

											const imageData = image.uri.includes("base64,")
												? image.uri.split("base64,")[1]
												: image.uri;

											const imageBuffer = Buffer.from(imageData, "base64");
											const fileType = getFileTypeFromMime(image.mimetype);
											const validationResult = validateImageResolution(
												image.size,
												2, // TODO: Use the actual upscale factor
											);
											if (!validationResult.isValid) {
												if (validationResult.error) {
													logger.warn(
														`Error validating image resolution: ${validationResult.error}. Skipping image upload.`,
													);
												} else {
													logger.warn(
														`Insufficient resolution (${validationResult.width}x${validationResult.height}).`,
													);
												}
												return;
											}

											const command = new PutObjectCommand({
												Bucket: buckets.processed.name,
												Key: `${payload.assetRef.id}/${image.label}-${image.index}.${fileType}`,
												Body: imageBuffer,
												ContentType: image.mimetype,
											});

											await s3Client.send(command);
										}),
									);
								},
							);
						},
					);
				}),
			);
		});

		return { payload };
	},
});
