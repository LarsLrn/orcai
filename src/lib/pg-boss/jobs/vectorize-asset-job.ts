// import { TokenChunker } from "@chonkiejs/core";
import { embedMany, generateText } from "ai";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import type { Job } from "pg-boss";
import { v4 as uuidv4 } from "uuid";
import { dbSchema } from "@/db/schema";
import { getSaiaEmbeddingModel, getSaiaModel } from "@/lib/ai/saia-models";
import { countTokens, type MarkdownNode } from "@/lib/chunk/markdown-chunker";
import { DB } from "@/lib/effect/services/drizzle";
import { PgBossError } from "@/lib/effect/utils/errors";
import type { Asset } from "@/lib/orpc/schemas/asset";
import type { Block } from "@/lib/orpc/schemas/block";
import type { VectorizeAssetPayload } from "@/lib/pg-boss/schema/vectorize-asset";
import type { FileType } from "@/lib/s3/schema/file-schema";
import { sendListObjectsCommand } from "@/lib/s3/utils/commands";
import {
	getImageAsBase64,
	getMarkdownAsString,
} from "@/lib/s3/utils/file-functions";
import {
	deletePointsByIdentifier,
	upsertPointsToQdrant,
} from "@/qdrant/mutations";
import { buckets } from "@/settings/buckets";
import {
	describeImagePrompt,
	describeTableImagePrompt,
} from "@/settings/prompts";

export const vectorizeAssetBatchEffect = (jobs: Job<VectorizeAssetPayload>[]) =>
	Effect.forEach(
		jobs,
		(job) =>
			vectorizeAssetsEffect({
				job,
			}),
		{
			discard: true,
		},
	);

const MAX_ERROR_MESSAGE_LENGTH = 320;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object";

const compactObject = (value: Record<string, unknown>) =>
	Object.fromEntries(
		Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
	);

const stringField = (value: unknown) =>
	typeof value === "string" ? value : undefined;

const numberField = (value: unknown) =>
	typeof value === "number" ? value : undefined;

const getStatusCode = (value: Record<string, unknown>) => {
	if (numberField(value.status) !== undefined) {
		return value.status;
	}
	if (numberField(value.statusCode) !== undefined) {
		return value.statusCode;
	}
	if (
		isRecord(value.$metadata) &&
		numberField(value.$metadata.httpStatusCode) !== undefined
	) {
		return value.$metadata.httpStatusCode;
	}
	return undefined;
};

const sanitizeMessage = (value: unknown) => {
	if (typeof value !== "string") return undefined;
	if (value.startsWith("data:")) {
		return `[redacted-data-url:${value.length} chars]`;
	}
	if (value.length > MAX_ERROR_MESSAGE_LENGTH) {
		return `${value.slice(0, MAX_ERROR_MESSAGE_LENGTH)}...[truncated ${value.length - MAX_ERROR_MESSAGE_LENGTH} chars]`;
	}
	return value;
};

const summarizeErrorCause = (cause: unknown): Record<string, unknown> => {
	if (typeof cause === "string") {
		return {
			message: sanitizeMessage(cause),
		};
	}

	if (cause instanceof Error) {
		const details = cause as Error & Record<string, unknown>;
		const nested = isRecord(details.cause) ? details.cause : undefined;
		return compactObject({
			name: cause.name,
			tag: stringField(details._tag),
			code: stringField(details.code),
			message: sanitizeMessage(cause.message),
			operation: stringField(details.operation),
			step: stringField(details.step),
			queue: stringField(details.queue),
			stage: stringField(details.stage),
			fileName: stringField(details.fileName),
			fileType: stringField(details.fileType),
			decodedBytes: numberField(details.decodedBytes),
			statusCode: getStatusCode(details),
			causeName: nested ? stringField(nested.name) : undefined,
			causeTag: nested ? stringField(nested._tag) : undefined,
			causeCode: nested ? stringField(nested.code) : undefined,
			causeMessage: nested ? sanitizeMessage(nested.message) : undefined,
			causeStatusCode: nested ? getStatusCode(nested) : undefined,
		});
	}

	if (!isRecord(cause)) {
		return {
			value: String(cause),
		};
	}

	const nested = isRecord(cause.cause) ? cause.cause : undefined;
	return compactObject({
		name: stringField(cause.name),
		tag: stringField(cause._tag),
		code: stringField(cause.code),
		message:
			sanitizeMessage(cause.message) ??
			(nested ? sanitizeMessage(nested.message) : undefined),
		operation: stringField(cause.operation),
		step: stringField(cause.step),
		queue: stringField(cause.queue),
		stage: stringField(cause.stage),
		fileName: stringField(cause.fileName),
		fileType: stringField(cause.fileType),
		decodedBytes: numberField(cause.decodedBytes),
		statusCode: getStatusCode(cause),
		causeName: nested ? stringField(nested.name) : undefined,
		causeTag: nested ? stringField(nested._tag) : undefined,
		causeCode: nested ? stringField(nested.code) : undefined,
		causeMessage: nested ? sanitizeMessage(nested.message) : undefined,
		causeStatusCode: nested ? getStatusCode(nested) : undefined,
	});
};

const toSanitizedPgBossRunError = (cause: unknown) =>
	new PgBossError({
		operation: "run",
		cause: summarizeErrorCause(cause),
	});

const isAssetAttachedToBlock = (params: { assetId: string; blockId: string }) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [link] = yield* db
			.select({
				assetId: dbSchema.blockAsset.assetId,
			})
			.from(dbSchema.blockAsset)
			.where(
				and(
					eq(dbSchema.blockAsset.assetId, params.assetId),
					eq(dbSchema.blockAsset.blockId, params.blockId),
				),
			);

		return Boolean(link);
	});

const vectorizeAssetsEffect = (params: { job: Job<VectorizeAssetPayload> }) =>
	Effect.gen(function* () {
		const { prefix, blockId, assetId } = params.job.data;
		const db = yield* DB;

		const [asset] = yield* db
			.select({
				id: dbSchema.asset.id,
				processingStatus: dbSchema.asset.processingStatus,
			})
			.from(dbSchema.asset)
			.where(eq(dbSchema.asset.id, assetId));

		if (!asset) {
			return yield* Effect.fail(
				new PgBossError({
					operation: "run",
					cause: new Error(`Asset ${assetId} not found for vectorization`),
				}),
			);
		}

		if (asset.processingStatus !== "completed") {
			yield* Effect.logInfo(
				{
					jobId: params.job.id,
					assetId,
					processingStatus: asset.processingStatus,
				},
				"Asset is not processed yet; vectorization will be retried",
			);

			return yield* Effect.fail(
				new PgBossError({
					operation: "run",
					cause: new Error(
						`Asset ${assetId} processing status is ${asset.processingStatus}, expected completed`,
					),
				}),
			);
		}

		const isInitiallyAttached = yield* isAssetAttachedToBlock({
			assetId,
			blockId,
		});

		if (!isInitiallyAttached) {
			yield* Effect.logInfo(
				{
					jobId: params.job.id,
					assetId,
					blockId,
				},
				"Skipping stale vectorization job for detached asset",
			);
			return;
		}

		const { Contents: files } = yield* sendListObjectsCommand({
			bucket: buckets.processed.name,
			prefix: `${prefix}/`,
		});

		if (!files || files.length === 0) {
			yield* Effect.logWarning(
				{
					prefix,
				},
				"No files found for processed asset",
			);

			return yield* Effect.fail(
				new PgBossError({
					operation: "run",
					cause: new Error(`No processed files found for asset ${assetId}`),
				}),
			);
		}

		const images: {
			description: string;
			tokens: number | undefined;
			name: string;
			type: FileType;
		}[] = [];

		const markdown: MarkdownNode[] = [];

		yield* Effect.forEach(
			files,
			(file) =>
				Effect.gen(function* () {
					const fileExtension = file.Key?.split(".").pop()?.toLowerCase();
					if (!fileExtension) {
						return;
					}
					const name = file.Key;

					if (fileExtension === "md" && name) {
						const text = yield* getMarkdownAsString({
							bucket: buckets.processed.name,
							name,
						});

						const processedMarkdown = yield* processMarkdownFile({
							fileContent: text,
							fileName: name,
						});

						markdown.push(...processedMarkdown);
					} else if (
						[
							"jpeg",
							"jpg",
							"png",
						].includes(fileExtension) &&
						name
					) {
						const image = yield* getImageAsBase64({
							bucket: buckets.processed.name,
							name,
						});

						const decodedBytes = Buffer.byteLength(image, "base64");

						const processedImage = yield* processImageFile({
							base64Image: image,
							name,
							fileExtension: fileExtension as FileType,
							decodedBytes,
						}).pipe(
							Effect.catchAll((err) =>
								Effect.logError(
									{
										jobId: params.job.id,
										assetId,
										blockId,
										fileName: name,
										fileType: fileExtension,
										objectBytes: file.Size,
										decodedBytes,
										err: summarizeErrorCause(err),
									},
									"Image description generation failed",
								).pipe(Effect.as(undefined)),
							),
						);

						if (processedImage) {
							images.push(processedImage);
						}
					}
				}),
			{
				concurrency: 2,
			},
		);

		const imageChunks = images.map((image) => ({
			content: image.description,
			depth: 0,
			length: image.tokens,
			title: image.name,
			page: undefined,
			type: "image",
		})) as MarkdownNode[];

		const mergedChunks = [
			...markdown,
			...imageChunks,
		];

		if (mergedChunks.length === 0) {
			return yield* Effect.fail(
				new PgBossError({
					operation: "run",
					cause: new Error(
						`No vectorizable chunks generated for asset ${assetId} in block ${blockId}`,
					),
				}),
			);
		}

		const isStillAttached = yield* isAssetAttachedToBlock({
			assetId,
			blockId,
		});

		if (!isStillAttached) {
			yield* Effect.logInfo(
				{
					jobId: params.job.id,
					assetId,
					blockId,
				},
				"Skipping vector upsert because asset was detached during processing",
			);
			return;
		}

		const qdrantResponse = yield* generateEmbeddings({
			chunks: mergedChunks,
			assetId,
			blockId,
		});

		return {
			payload: {
				assetId,
				blockId,
			},
			results: {
				qdrant: qdrantResponse,
			},
		};
	});

const extractPageFromFileName = (fileName: string) => {
	const filePage = /page-(\d+)\.md$/i.exec(fileName);
	if (!filePage?.[1]) return undefined;
	const value = Number.parseInt(filePage[1], 10);
	if (Number.isNaN(value)) return undefined;

	return value;
};

const getImageMimeType = (fileExtension: FileType) => {
	if (fileExtension === "jpg" || fileExtension === "jpeg") {
		return "image/jpeg";
	}

	if (fileExtension === "png") {
		return "image/png";
	}

	return `image/${fileExtension}`;
};

const processMarkdownFile = ({
	fileContent,
	fileName,
}: {
	fileContent: string;
	fileName: string;
}) => {
	const page = extractPageFromFileName(fileName);
	const title =
		page !== undefined ? `${fileName} (page ${String(page + 1)})` : fileName;

	/* TODO: Reintroduce a configurable chunking strategy (per-page vs token-based).
	Token-based chunking kept for quick re-enable:
	const chunker = yield* Effect.promise(() =>
	 	TokenChunker.create({
	 		chunkSize: 560,
	 		chunkOverlap: 96,
	 	}),
	);
	return yield* Effect.tryPromise({
	 	try: () => chunker.chunk(fileContent),
	 	catch: (cause) =>
	 		new PgBossError({
	 			operation: "run",
	 			cause,
	 		}),
	}).pipe(
	 	Effect.map(
	 		(chunks) =>
	 			chunks.map((chunk) => ({
	 				title,
	 				page,
	 				depth: 0,
	 				content: chunk.text,
	 				length: chunk.tokenCount,
	 				type: "text",
	 			})) as MarkdownNode[],
	 	),
	); */

	return Effect.succeed([
		{
			title,
			page,
			depth: 0,
			content: fileContent,
			length: countTokens(fileContent),
			type: "text",
		},
	] as MarkdownNode[]);
};

const processImageFile = (params: {
	base64Image: string;
	name: string;
	fileExtension: FileType;
	decodedBytes: number;
}) =>
	Effect.gen(function* () {
		const mimeType = getImageMimeType(params.fileExtension);
		const imageType = params.name.startsWith("table") ? "table" : "picture";
		const imageBytes = Buffer.from(params.base64Image, "base64");

		return yield* Effect.tryPromise({
			try: () =>
				generateText({
					model: getSaiaModel({
						input: [
							"image",
						],
						model: "gemma-3-27b-it",
					}).provider,
					maxOutputTokens: 1024,
					system:
						imageType === "table"
							? describeTableImagePrompt
							: describeImagePrompt,
					messages: [
						{
							role: "user",
							content: [
								{
									type: "image",
									image: imageBytes,
									mediaType: mimeType,
								},
							],
						},
					],
				}),
			catch: (cause) =>
				new PgBossError({
					operation: "run",
					cause: {
						stage: "image-description-generation",
						fileName: params.name,
						fileType: params.fileExtension,
						decodedBytes: params.decodedBytes,
						error: summarizeErrorCause(cause),
					},
				}),
		}).pipe(
			Effect.map((result) => ({
				description: result.text,
				tokens: result.usage.totalTokens,
				name: params.name,
				type: mimeType.split("/")[1] as FileType,
			})),
		);
	});

const generateEmbeddings = ({
	chunks,
	assetId,
	blockId,
}: {
	chunks: MarkdownNode[];
	assetId: Asset["id"];
	blockId: Block["id"];
}) =>
	Effect.gen(function* () {
		const embedResults = yield* Effect.tryPromise({
			try: async () =>
				await embedMany({
					model: getSaiaEmbeddingModel({
						model: "e5-mistral-7b-instruct",
					}).provider,
					values: chunks.map((chunk) => chunk.content),
				}),
			catch: toSanitizedPgBossRunError,
		});

		// Create metadata for each chunk
		const metaDataChunks = chunks.map((chunk, index) => {
			// Create the base payload properties common to both types
			const basePayload = {
				asset_id: assetId,
				block_id: blockId,
				text: embedResults.values[index],
				title: chunk.title,
				page: chunk.page,
				depth: chunk.depth,
				tokens: chunk.length,
				chunk_index: index,
				chunkCount: chunks.length,
				createdAt: new Date().toISOString(),
			};

			// Create the discriminated union part based on the chunk type
			const specificPayload =
				chunk.type === "image"
					? {
							source: "image" as const,
							file_reference: chunk.fileReference,
							file_type: chunk.fileType,
						}
					: {
							source: "text" as const,
							file_reference: undefined,
							file_type: undefined,
						};

			// Combine them and return the complete chunk
			return {
				id: uuidv4(),
				vector: embedResults.embeddings[index],
				payload: {
					...basePayload,
					...specificPayload,
				},
			};
		});

		yield* deletePointsByIdentifier({
			assetId,
			blockId,
		});

		const qdrantResult = yield* upsertPointsToQdrant({
			points: metaDataChunks,
		});

		return {
			success: true,
			type: "markdown",
			qdrant: qdrantResult,
		};
	});
