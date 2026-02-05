import { PutObjectCommand } from "@aws-sdk/client-s3";
import * as Effect from "effect/Effect";
import type { Job } from "pg-boss";
import {
	type SerializedDocument,
	serializeDoclingDocument,
} from "@/lib/ai/docling-serialize";
import { PgBossService } from "@/lib/effect/services/pg-boss";
import { serverEnv } from "@/lib/env/server";
import type { ProcessAssetPayload } from "@/lib/pg-boss/schema/process-asset";
import { toPgBossRunError } from "@/lib/pg-boss/utils/error-helper";
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

export const processAssetBatchEffect = (jobs: Job<ProcessAssetPayload>[]) =>
	Effect.forEach(jobs, (job) => processAssetsEffect({ job }), {
		discard: true,
	});

const processAssetsEffect = (params: { job: Job<ProcessAssetPayload> }) =>
	Effect.gen(function* () {
		const { assetRef, blockId, mergePages } = params.job.data;

		const doclingApi = `${serverEnv.OPENAI_COMPATIBLE_BASE_URL}/documents/convert`;

		const presignedUrl = yield* Effect.tryPromise({
			try: () => createPresignedUrlToDownload(assetRef),
			catch: toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME),
		}).pipe(
			Effect.tapError((err) =>
				Effect.logError({ err }, "Error creating presigned URL"),
			),
		);

		const fileResponse = yield* Effect.tryPromise({
			try: () => fetch(presignedUrl),
			catch: toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME),
		}).pipe(
			Effect.flatMap((response) => {
				if (!response.ok) {
					return Effect.fail(
						toPgBossRunError(
							params.job.id,
							PROCESS_ASSET_JOB_NAME,
						)(
							new Error(
								`Failed to fetch file from presigned URL: ${response.status} ${response.statusText}`,
							),
						),
					);
				}
				return Effect.succeed(response);
			}),
			Effect.tapError((err) =>
				Effect.logError({ err }, "Error fetching file from presigned URL"),
			),
		);

		const fileBuffer = yield* Effect.tryPromise({
			try: () => fileResponse.arrayBuffer().then(Buffer.from),
			catch: toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME),
		}).pipe(
			Effect.tapError((err) =>
				Effect.logError({ err }, "Error reading file buffer"),
			),
		);

		const doclingResponse = yield* Effect.tryPromise({
			try: async (signal) => {
				const formData = new FormData();
				const fileBlob = new Blob([fileBuffer]);
				formData.append("document", fileBlob, `document.${assetRef.id}`);

				const params = new URLSearchParams({
					response_type: "json",
					extract_tables_as_images: "false",
				});

				const response = await fetch(`${doclingApi}?${params}`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${serverEnv.OPENAI_COMPATIBLE_API_KEY}`,
					},
					body: formData,
					signal,
				});

				return response;
			},
			catch: toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME),
		}).pipe(
			Effect.timeoutFail({
				duration: "15 minutes",
				onTimeout: () =>
					toPgBossRunError(
						params.job.id,
						PROCESS_ASSET_JOB_NAME,
					)(new Error("Docling API request timed out after 15 minutes")),
			}),
			Effect.flatMap((response) => {
				if (!response.ok) {
					return Effect.fail(
						toPgBossRunError(
							params.job.id,
							PROCESS_ASSET_JOB_NAME,
						)(
							new Error(
								`Docling API request failed: ${response.status} ${response.statusText}`,
							),
						),
					);
				}
				return Effect.succeed(response);
			}),
			Effect.tapError((err) =>
				Effect.logError({ err }, "Error in Docling API response"),
			),
		);

		const processedDocument = yield* Effect.tryPromise({
			try: async () => {
				const text = await doclingResponse.text();
				return JSON.parse(text) as SaiaDoclingData;
			},
			catch: toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME),
		}).pipe(
			Effect.tapError((err) =>
				Effect.logError({ err }, "Error parsing Docling API response"),
			),
		);

		const json = processedDocument.json_data;

		const serializedDocling = yield* Effect.try({
			try: () =>
				serializeDoclingDocument(json, {
					keepImageRefs: true,
					mergePages,
				}) as SerializedDocument[],
			catch: toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME),
		}).pipe(
			Effect.tapError((err) =>
				Effect.logError({ err }, "Error serializing Docling document"),
			),
		);

		yield* Effect.tryPromise({
			try: async () =>
				await deletePrefixRecursively({
					bucket: buckets.processed.name,
					prefix: `${assetRef.id}/`,
				}),
			catch: toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME),
		}).pipe(
			Effect.tapError((err) =>
				Effect.logError({ err }, "Error clearing existing processed content"),
			),
		);

		if (!serializedDocling || serializedDocling.length === 0) {
			yield* Effect.logWarning(
				{ jobId: params.job.id },
				"No serialized docling content to upload",
			);
			return;
		}

		yield* Effect.logInfo(
			{ jobId: params.job.id, pageCount: serializedDocling.length },
			"Uploading processed content",
		);

		yield* Effect.forEach(serializedDocling, (page, index) =>
			Effect.gen(function* () {
				const { markdown, images } = page;

				const command = new PutObjectCommand({
					Bucket: buckets.processed.name,
					Key: `${assetRef.id}/page-${page.page}.md`,
					Body: Buffer.from(markdown, "utf-8"),
					ContentType: "text/markdown",
				});

				yield* Effect.tryPromise({
					try: () => s3Client.send(command),
					catch: toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME),
				}).pipe(
					Effect.tapError((err) =>
						Effect.logError({ err }, "Error uploading processed markdown"),
					),
				);

				yield* Effect.forEach(images, (image, imageIndex) =>
					Effect.gen(function* () {
						if (!image) {
							yield* Effect.logWarning(
								{ jobId: params.job.id, pageIndex: index, imageIndex },
								"No image data to upload for this image",
							);
							return;
						}

						yield* Effect.logInfo(
							{ jobId: params.job.id, pageIndex: index, imageIndex },
							"Uploading processed image",
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
							yield* Effect.logWarning(
								{
									jobId: params.job.id,
									pageIndex: index,
									imageIndex,
									width: validationResult.width,
									height: validationResult.height,
									error: validationResult.error,
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

						return yield* Effect.tryPromise({
							try: () => s3Client.send(command),
							catch: toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME),
						}).pipe(
							Effect.tapError((err) =>
								Effect.logError({ err }, "Error uploading processed image"),
							),
						);
					}),
				);
				yield* Effect.logInfo(
					{ jobId: params.job.id, pageIndex: index },
					"Completed uploading processed page",
				);
			}),
		).pipe(
			Effect.tapError((err) =>
				Effect.logError({ err }, "Error uploading processed content"),
			),
		);

		const { boss } = yield* PgBossService;

		yield* Effect.tryPromise({
			try: () =>
				boss.send(
					VECTORIZE_ASSET_JOB_NAME,
					{
						prefix: assetRef.id,
						blockId,
						assetId: assetRef.id,
						mergePages,
					},
					{ startAfter: 5 },
				),
			catch: toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME),
		}).pipe(
			Effect.tapError((err) =>
				Effect.logError({ err }, "Error scheduling vectorization job"),
			),
		);

		yield* Effect.logInfo(`Completed job ${params.job.id}`);
	});
