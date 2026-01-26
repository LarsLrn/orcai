import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { Job } from "pg-boss";
import {
	type SerializedDocument,
	serializeDoclingDocument,
} from "@/lib/ai/docling-serialize";
import { serverEnv } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";
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
	const log = logger.child({ module: "process-asset-job" });

	for (const job of jobs) {
		const { assetRef, blockId, mergePages } = job.data;

		log.info(
			{ jobId: job.id, assetRef, blockId },
			"Starting process asset job",
		);

		const doclingApi = `${serverEnv.OPENAI_COMPATIBLE_BASE_URL}/documents/convert`;

		const presignedUrl = await createPresignedUrlToDownload(assetRef);

		// Download the file using the presigned URL
		const fileResponse = await (async () => {
			try {
				return await fetch(presignedUrl);
			} catch (error) {
				log.error({ err: error, jobId: job.id }, "Error downloading file");
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
				log.error({ err: error, jobId: job.id }, "Docling API fetch error");

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
			log.error(
				{ err: error, jobId: job.id },
				"Failed to parse Docling API response",
			);
			throw error;
		}

		const json = processedDocument.json_data;

		const serializedDocling: SerializedDocument[] | undefined =
			serializeDoclingDocument(json, {
				keepImageRefs: true,
				mergePages,
			});

		await deletePrefixRecursively({
			bucket: buckets.processed.name,
			prefix: `${assetRef.id}/`,
		});

		if (!serializedDocling || serializedDocling.length === 0) {
			log.warn({ jobId: job.id }, "No serialized docling content to upload");
			continue;
		}

		log.info(
			{ jobId: job.id, pageCount: serializedDocling.length },
			"Uploading processed content",
		);

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
							log.warn("Undefined image. Skipping upload.");
							return;
						}

						log.debug(
							{ label: image.label, index: image.index, mime: image.mimetype },
							"Processing image",
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
							log.warn(
								{
									error: validationResult.error,
									width: validationResult.width,
									height: validationResult.height,
								},
								"Skipping image upload due to resolution/validation",
							);
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

		log.info({ jobId: job.id }, "Process asset job completed");
	}
}
