import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { Job } from "pg-boss";
import {
	type SerializedDocument,
	serializeDoclingDocument,
} from "@/lib/ai/docling-serialize";
import { serverEnv } from "@/lib/env/server";
import { getPgBoss } from "@/lib/pg-boss/pg-boss-client";
import type { ProcessAssetPayload } from "@/lib/pg-boss/schema/process-asset";
import { validateImageResolution } from "@/lib/pg-boss/utils/validate-image-resolution";
import {
	createPresignedUrlToDownload,
	deletePrefixRecursively,
} from "@/lib/s3/file-functions";
import { s3Client } from "@/lib/s3/s3-client";
import { getFileTypeFromMime } from "@/lib/s3/upload-helpers";
import { buckets } from "@/settings/buckets";
import type { SaiaDoclingData } from "@/types/docling";
import { VECTORIZE_ASSET_JOB_NAME } from "./vectorize-asset-job";

export const PROCESS_ASSET_JOB_NAME = "process-asset-job";

export async function handleProcessAssetJob(jobs: Job<ProcessAssetPayload>[]) {
	for (const job of jobs) {
		const { assetRef, blockId, mergePages } = job.data;

		console.log(`[${PROCESS_ASSET_JOB_NAME}] Starting job ${job.id}:`, {
			assetRef,
			blockId,
			mergePages,
		});

		const doclingApi = `${serverEnv.OPENAI_COMPATIBLE_BASE_URL}/documents/convert`;

		const presignedUrl = await createPresignedUrlToDownload(assetRef);

		// Download the file using the presigned URL
		const fileResponse = await (async () => {
			try {
				return await fetch(presignedUrl);
			} catch (error) {
				console.error(
					`[${PROCESS_ASSET_JOB_NAME}] Error downloading file for job ${job.id}:`,
					error,
				);
				throw error;
			}
		})();

		if (!fileResponse.ok) {
			throw new Error(
				`Failed to download file: ${fileResponse.status} ${fileResponse.statusText}`,
			);
		}

		// Get the file content as a buffer
		const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

		const doclingResponse = await (async () => {
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
				formData.append("document", fileBlob, `document.${assetRef.id}`);

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
				console.error(
					`[${PROCESS_ASSET_JOB_NAME}] Docling API fetch error: ${error instanceof Error ? error.message : String(error)}`,
				);

				throw error;
			}
		})();

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
			console.error(
				`[${PROCESS_ASSET_JOB_NAME}] Failed to parse Docling API response for job ${job.id}: ${error instanceof Error ? error.message : String(error)}`,
			);
			throw error;
		}

		const json = processedDocument.json_data;

		const serializedDocling: SerializedDocument[] | undefined =
			serializeDoclingDocument(json, {
				keepImageRefs: true,
				mergePages,
			});

		async () => {
			await deletePrefixRecursively({
				bucket: buckets.processed.name,
				prefix: `${assetRef.id}/`,
			});
		};

		async () => {
			if (!serializedDocling || serializedDocling.length === 0) {
				console.log("No serialized docling content to upload for markdown.");
				return;
			}

			await Promise.all(
				serializedDocling.map(async (page) => {
					const markdown = page.markdown;

					const command = new PutObjectCommand({
						Bucket: buckets.processed.name,
						Key: `${assetRef.id}/page-${page.page}.md`,
						Body: Buffer.from(markdown, "utf-8"),
						ContentType: "text/markdown",
					});

					await s3Client.send(command);

					const images = page.images;

					await Promise.all(
						images.map(async (image) => {
							if (!image) {
								console.info("Undefined image. Skipping upload.");
								return;
							}

							console.log(
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
									console.error(
										`Error validating image resolution: ${validationResult.error}. Skipping image upload.`,
									);
								} else {
									console.error(
										`Insufficient resolution (${validationResult.width}x${validationResult.height}). Skipping image upload.`,
									);
								}
								return;
							}

							const command = new PutObjectCommand({
								Bucket: buckets.processed.name,
								Key: `${assetRef.id}/${image.label}-${image.index}.${fileType}`,
								Body: imageBuffer,
								ContentType: image.mimetype,
							});

							await s3Client.send(command);
						}),
					);
				}),
			);
		};

		const boss = await getPgBoss();
		await boss.send(
			VECTORIZE_ASSET_JOB_NAME,
			{
				prefix: assetRef.id,
				blockId,
				assetId: assetRef.id,
				mergePages,
			},
			{ startAfter: 5 },
		);
	}
}
