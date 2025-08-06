import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { Size } from "@docling/docling-core";
import { logger, task } from "@trigger.dev/sdk/v3";
import FormData from "form-data";
import nodeFetch from "node-fetch";
/* import type { ProcessingStatus } from "@/app/api/docs/processing/route"; */
import {
	type SerializedDocument,
	serializeDoclingDocument,
} from "@/lib/ai/docling-serialize";
import {
	createPresignedUrlToDownload,
	deletePrefixRecursively,
} from "@/lib/s3/file-functions";
import { s3Client } from "@/lib/s3/s3-client";
import { getFileTypeFromMime } from "@/lib/s3/upload-helpers";
import { buckets } from "@/settings/buckets";
import type { SaiaDoclingData } from "@/types/docling";
import type { ProcessAssetTaskPayload } from "@/types/trigger";
import { vectorizeAssetTask } from "./vectorize-asset-task";

/**
 * Validates if an image meets minimum resolution requirements
 * @param imageBuffer The image buffer to check
 * @returns An object containing validation result and metadata
 */
function validateImageResolution(size: Size, upscaleFactor = 1) {
	// Define minimum resolution requirements
	const MIN_IMAGE_WIDTH = 100 * upscaleFactor; // pixels
	const MIN_IMAGE_HEIGHT = 100 * upscaleFactor; // pixels
	const MIN_SINGLE_DIMENSION = 50 * upscaleFactor; // pixels

	try {
		const width = size.width || 0;
		const height = size.height || 0;

		/* Images have to be at least 20 pixels in any dimension
    and at least 100 pixels in either width or height
    to be considered valid
    MIN_SINGLE_DIMENSION ensures very narrow or flat images are not accepted */
		const isValidResolution =
			(width >= MIN_IMAGE_WIDTH || height >= MIN_IMAGE_HEIGHT) &&
			width > MIN_SINGLE_DIMENSION &&
			height > MIN_SINGLE_DIMENSION;

		return {
			isValid: isValidResolution,
		};
	} catch (error) {
		logger.error(
			`Error validating image resolution: ${error instanceof Error ? error.message : String(error)}`,
		);
		return {
			isValid: false,
			width: 0,
			height: 0,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export const processAssetTask = task({
	id: "process-asset-task",
	maxDuration: 1200,
	queue: {
		concurrencyLimit: 2,
	},
	async onSuccess(payload) {
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
	run: async (payload: ProcessAssetTaskPayload) => {
		const doclingApi = `${process.env.OPENAI_COMPATIBLE_BASE_URL}/documents/convert`;

		const presignedUrl = await createPresignedUrlToDownload(payload.assetRef);

		// Download the file using the presigned URL
		const fileResponse = await logger.trace("download-file", async () => {
			try {
				return await nodeFetch(presignedUrl);
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

				// Create FormData to properly send the file
				const formData = new FormData();
				formData.append("document", fileBuffer, {
					filename: `document.${payload.assetRef.id}`,
				});

				const params = new URLSearchParams({
					response_type: "json",
					extract_tables_as_images: "true",
				});

				// Use the signal from the controller in the fetch call
				const response = await nodeFetch(`${doclingApi}?${params}`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${process.env.OPENAI_COMPATIBLE_API_KEY}`,
						...formData.getHeaders(), // This adds the correct Content-Type header
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
												logger.warn(
													`Insufficient resolution (${validationResult.width}x${validationResult.height}).`,
												);
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
