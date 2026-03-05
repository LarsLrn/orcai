import * as Effect from "effect/Effect";
import type { Job } from "pg-boss";
import { serializeDoclingPayload } from "@/lib/ai/utils/docling-conversion";
import { DoclingService } from "@/lib/effect/services/docling";
import { PgBossService } from "@/lib/effect/services/pg-boss";
import {
	PROCESS_ASSET_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
} from "@/lib/pg-boss/schema/job-queues";
import type { ProcessAssetPayload } from "@/lib/pg-boss/schema/process-asset";
import { toPgBossRunError } from "@/lib/pg-boss/utils/error-helper";
import { validateImageResolution } from "@/lib/pg-boss/utils/validate-image-resolution";
import { sendPutObjectCommand } from "@/lib/s3/utils/commands";
import { deletePrefixRecursively } from "@/lib/s3/utils/file-functions";
import { getFileTypeFromMime } from "@/lib/s3/utils/file-type-helpers";
import { getDownloadUrl } from "@/lib/s3/utils/url-helpers";
import { buckets } from "@/settings/buckets";

export const processAssetBatchEffect = (jobs: Job<ProcessAssetPayload>[]) =>
	Effect.forEach(
		jobs,
		(job) =>
			processAssetsEffect({
				job,
			}),
		{
			discard: true,
		},
	);

const processAssetsEffect = (params: { job: Job<ProcessAssetPayload> }) =>
	Effect.gen(function* () {
		const { convertDocument } = yield* DoclingService;
		const { assetRef, blockId, mergePages } = params.job.data;

		const presignedUrl = yield* getDownloadUrl({
			bucket: assetRef.bucket,
			key: `${assetRef.prefix}/${assetRef.id}.${assetRef.type}`,
			endpointMode: "internal",
		});

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
				Effect.logError(
					{
						err,
					},
					"Error fetching file from presigned URL",
				),
			),
		);

		const fileBuffer = yield* Effect.tryPromise({
			try: () => fileResponse.arrayBuffer().then(Buffer.from),
			catch: toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME),
		}).pipe(
			Effect.tapError((err) =>
				Effect.logError(
					{
						err,
					},
					"Error reading file buffer",
				),
			),
		);

		const processedDocument = yield* convertDocument({
			document: fileBuffer,
			filename: `document.${assetRef.id}`,
			extractTablesAsImages: false,
		}).pipe(
			Effect.mapError(toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME)),
			Effect.tapError((err) =>
				Effect.logError(
					{
						err,
					},
					"Error converting document with Docling",
				),
			),
		);

		const serializedDocling = yield* Effect.try({
			try: () =>
				serializeDoclingPayload(processedDocument, {
					keepImageRefs: true,
					mergePages,
				}),
			catch: toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME),
		}).pipe(
			Effect.tapError((err) =>
				Effect.logError(
					{
						err,
					},
					"Error serializing Docling document",
				),
			),
		);

		yield* deletePrefixRecursively({
			bucket: buckets.processed.name,
			prefix: `${assetRef.id}/`,
		});

		if (!serializedDocling || serializedDocling.length === 0) {
			yield* Effect.logWarning(
				{
					jobId: params.job.id,
				},
				"No serialized docling content to upload",
			);
			return;
		}

		yield* Effect.logInfo(
			{
				jobId: params.job.id,
				pageCount: serializedDocling.length,
			},
			"Uploading processed content",
		);

		yield* Effect.forEach(serializedDocling, (page, index) =>
			Effect.gen(function* () {
				const { markdown, images } = page;

				yield* sendPutObjectCommand({
					bucket: buckets.processed.name,
					key: `${assetRef.id}/page-${page.page}.md`,
					body: Buffer.from(markdown, "utf-8"),
					contentType: "text/markdown",
				}).pipe(
					Effect.tapError((err) =>
						Effect.logError(
							{
								err,
							},
							"Error uploading processed markdown",
						),
					),
				);

				yield* Effect.forEach(images, (image, imageIndex) =>
					Effect.gen(function* () {
						if (!image) {
							yield* Effect.logWarning(
								{
									jobId: params.job.id,
									pageIndex: index,
									imageIndex,
								},
								"No image data to upload for this image",
							);
							return;
						}

						yield* Effect.logInfo(
							{
								jobId: params.job.id,
								pageIndex: index,
								imageIndex,
							},
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
							return yield* Effect.logWarning(
								{
									jobId: params.job.id,
									pageIndex: index,
									imageIndex,
									width: image.size.width,
									height: image.size.height,
								},
								"Skipping image upload due to resolution/validation",
							);
						}

						return yield* sendPutObjectCommand({
							bucket: buckets.processed.name,
							key: `${assetRef.id}/${image.label}-${image.index}.${fileType}`,
							body: imageBuffer,
							contentType: image.mimetype,
						}).pipe(
							Effect.tapError((err) =>
								Effect.logError(
									{
										err,
									},
									"Error uploading processed image",
								),
							),
						);
					}),
				);
				yield* Effect.logInfo(
					{
						jobId: params.job.id,
						pageIndex: index,
					},
					"Completed uploading processed page",
				);
			}),
		).pipe(
			Effect.tapError((err) =>
				Effect.logError(
					{
						err,
					},
					"Error uploading processed content",
				),
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
					{
						startAfter: 5,
					},
				),
			catch: toPgBossRunError(params.job.id, PROCESS_ASSET_JOB_NAME),
		}).pipe(
			Effect.tapError((err) =>
				Effect.logError(
					{
						err,
					},
					"Error scheduling vectorization job",
				),
			),
		);

		yield* Effect.logInfo(`Completed job ${params.job.id}`);
	});
