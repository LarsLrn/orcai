import { countTokens, getSaiaEmbeddingModel, getSaiaModel } from "@orcai/ai";
import {
	buckets,
	describeImagePrompt,
	describeTableImagePrompt,
} from "@orcai/core";
import { DB, type DB as DBService, dbSchema } from "@orcai/db";
import { PgBossError, type PgBossService } from "@orcai/pg-boss";
import {
	buildStoredExtractionKey,
	type StoredExtractionArtifact,
} from "@orcai/process";
import {
	deletePointsByIdentifier,
	type QdrantService,
	upsertPointsToQdrant,
} from "@orcai/qdrant";
import {
	getImageAsBase64,
	getObjectAsJson,
	type S3Service,
} from "@orcai/s3/server";
import type { FileType, VectorizeAssetPayload } from "@orcai/schema";
import { embedMany, generateText } from "ai";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import type { Job } from "pg-boss";
import { v4 as uuidv4 } from "uuid";

export const vectorizeAssetBatchEffect = (
	jobs: Job<VectorizeAssetPayload>[],
): Effect.Effect<
	void,
	unknown,
	DBService | S3Service | QdrantService | PgBossService
> =>
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

type VectorPointSource = "text" | "image";

type VectorizableChunk = {
	content: string;
	embeddingContent: string;
	tokens: number;
	documentTotalPages?: number;
	chunkPageStart?: number;
	chunkPageEnd?: number;
	depth: number;
	chunkIndex: number;
	chunkCount: number;
	source: VectorPointSource;
	fileReference?: string;
	fileType?: FileType;
};

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

const toValidPageNumber = (value: number | undefined) =>
	typeof value === "number" && Number.isInteger(value) && value >= 1
		? value
		: undefined;

const extractDocumentTotalPages = (extraction: StoredExtractionArtifact) => {
	const pageStructure = extraction.metadata.page_structure as
		| {
				totalCount?: number | null;
		  }
		| null
		| undefined;

	return toValidPageNumber(
		pageStructure?.totalCount ?? extraction.metadata.pageCount ?? undefined,
	);
};

const formatHeadingContext = (
	headings:
		| {
				headings: Array<{
					level: number;
					text: string;
				}>;
		  }
		| undefined,
) => {
	if (!headings || headings.headings.length === 0) {
		return undefined;
	}

	return headings.headings.map((heading) => heading.text.trim()).join(" > ");
};

const resolveChunkDepth = (
	headings:
		| {
				headings: Array<{
					level: number;
					text: string;
				}>;
		  }
		| undefined,
) => headings?.headings.at(-1)?.level ?? 0;

const normalizeImageFormat = (
	format: string,
): {
	contentType: string;
	fileType?: FileType;
} => {
	const normalizedFormat = format.toLowerCase();

	if (normalizedFormat === "jpg" || normalizedFormat === "jpeg") {
		return {
			contentType: "image/jpeg",
			fileType: normalizedFormat,
		};
	}

	if (
		normalizedFormat === "png" ||
		normalizedFormat === "gif" ||
		normalizedFormat === "webp"
	) {
		return {
			contentType: `image/${normalizedFormat}`,
			fileType: normalizedFormat,
		};
	}

	return {
		contentType: `image/${normalizedFormat}`,
	};
};

const TABLE_HINT_REGEX = /\btable\b/i;

const isLikelyTableImage = (
	image: StoredExtractionArtifact["images"][number],
) => {
	if (image.description && TABLE_HINT_REGEX.test(image.description)) {
		return true;
	}

	if (image.sourcePath && TABLE_HINT_REGEX.test(image.sourcePath)) {
		return true;
	}

	return false;
};

const buildTextChunks = ({
	extraction,
}: {
	extraction: StoredExtractionArtifact;
}): VectorizableChunk[] => {
	const documentTotalPages = extractDocumentTotalPages(extraction);
	const chunks =
		extraction.chunks.length > 0
			? [
					...extraction.chunks,
				].sort((a, b) => a.metadata.chunkIndex - b.metadata.chunkIndex)
			: extraction.content.trim().length > 0
				? [
						{
							content: extraction.content.trim(),
							chunkType: "document",
							metadata: {
								byteStart: 0,
								byteEnd: Buffer.byteLength(extraction.content, "utf-8"),
								chunkIndex: 0,
								totalChunks: 1,
							},
						},
					]
				: [];

	return chunks.map((chunk, index) => {
		const chunkPageStart = toValidPageNumber(
			chunk.metadata.firstPage ?? undefined,
		);
		const chunkPageEnd = toValidPageNumber(
			chunk.metadata.lastPage ?? chunkPageStart ?? undefined,
		);
		const headingContext = formatHeadingContext(
			chunk.metadata.headingContext ?? undefined,
		);
		const embeddingContent = headingContext
			? `${headingContext}\n\n${chunk.content}`
			: chunk.content;

		return {
			content: chunk.content,
			embeddingContent,
			tokens: chunk.metadata.tokenCount ?? countTokens(embeddingContent),
			documentTotalPages,
			chunkPageStart,
			chunkPageEnd,
			depth: resolveChunkDepth(chunk.metadata.headingContext ?? undefined),
			chunkIndex: chunk.metadata.chunkIndex ?? index,
			chunkCount: chunk.metadata.totalChunks ?? chunks.length,
			source: "text",
		};
	});
};

const processImageFile = (params: {
	base64Image: string;
	contentType: string;
	systemPrompt: string;
	fileType?: FileType;
	fileReference: string;
	decodedBytes: number;
	pageNumber?: number | null;
	chunkIndex: number;
	chunkCount: number;
}) =>
	Effect.gen(function* () {
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
					system: params.systemPrompt,
					messages: [
						{
							role: "user",
							content: [
								{
									type: "image",
									image: imageBytes,
									mediaType: params.contentType,
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
						fileName: params.fileReference,
						fileType: params.fileType,
						decodedBytes: params.decodedBytes,
						error: summarizeErrorCause(cause),
					},
				}),
		}).pipe(
			Effect.map((result) => ({
				content: result.text,
				embeddingContent: result.text,
				tokens: result.usage.totalTokens ?? countTokens(result.text),
				documentTotalPages: undefined,
				chunkPageStart: toValidPageNumber(params.pageNumber ?? undefined),
				chunkPageEnd: toValidPageNumber(params.pageNumber ?? undefined),
				depth: 0,
				chunkIndex: params.chunkIndex,
				chunkCount: params.chunkCount,
				source: "image" as const,
				fileReference: params.fileReference,
				fileType: params.fileType,
			})),
		);
	});

const buildImageChunks = ({
	extraction,
	jobId,
	assetId,
	blockId,
}: {
	extraction: StoredExtractionArtifact;
	jobId: string;
	assetId: string;
	blockId: string;
}) => {
	const textChunkCount = extraction.chunks.length;
	const totalChunkCount = textChunkCount + extraction.images.length;
	const documentTotalPages = extractDocumentTotalPages(extraction);

	return Effect.forEach(
		extraction.images,
		(image, imageIndex) =>
			Effect.gen(function* () {
				if (!image.sourcePath) {
					yield* Effect.logWarning(
						{
							jobId,
							assetId,
							blockId,
							imageIndex: image.imageIndex,
						},
						"Skipping extracted image without stored sourcePath",
					);
					return undefined;
				}

				const base64Image = yield* getImageAsBase64({
					bucket: buckets.processed.name,
					name: image.sourcePath,
				});

				const decodedBytes = Buffer.byteLength(base64Image, "base64");
				const normalizedFormat = normalizeImageFormat(image.format);
				const systemPrompt = isLikelyTableImage(image)
					? describeTableImagePrompt
					: describeImagePrompt;

				const chunk = yield* processImageFile({
					base64Image,
					contentType: normalizedFormat.contentType,
					systemPrompt,
					fileType: normalizedFormat.fileType,
					fileReference: image.sourcePath,
					decodedBytes,
					pageNumber: image.pageNumber,
					chunkIndex: textChunkCount + imageIndex,
					chunkCount: totalChunkCount,
				}).pipe(
					Effect.catchAll((err) =>
						Effect.logError(
							{
								jobId,
								assetId,
								blockId,
								fileName: image.sourcePath,
								fileType: image.format,
								decodedBytes,
								err: summarizeErrorCause(err),
							},
							"Image description generation failed",
						).pipe(Effect.as(undefined)),
					),
				);

				return chunk
					? {
							...chunk,
							documentTotalPages,
						}
					: undefined;
			}),
		{
			concurrency: 2,
		},
	).pipe(
		Effect.map(
			(images) =>
				images.filter((image) => image !== undefined) as VectorizableChunk[],
		),
	);
};

const vectorizeAssetsEffect = (params: { job: Job<VectorizeAssetPayload> }) =>
	Effect.gen(function* () {
		const { blockId, assetId } = params.job.data;
		const db = yield* DB;

		const [asset] = yield* db
			.select({
				id: dbSchema.asset.id,
				title: dbSchema.asset.title,
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

		const extraction = yield* getObjectAsJson<StoredExtractionArtifact>({
			bucket: buckets.processed.name,
			name: buildStoredExtractionKey(assetId),
		}).pipe(Effect.mapError(toSanitizedPgBossRunError));

		const textChunks = buildTextChunks({
			extraction,
		});

		const imageChunks: VectorizableChunk[] = yield* buildImageChunks({
			extraction,
			jobId: params.job.id,
			assetId,
			blockId,
		});

		const mergedChunks: VectorizableChunk[] = [
			...textChunks,
			...imageChunks,
		].map(
			(chunk, index, chunks): VectorizableChunk => ({
				...chunk,
				chunkIndex: chunk.source === "text" ? chunk.chunkIndex : index,
				chunkCount: chunks.length,
			}),
		);

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
			assetTitle: asset.title,
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

const generateEmbeddings = ({
	chunks,
	assetId,
	assetTitle,
	blockId,
}: {
	chunks: VectorizableChunk[];
	assetId: string;
	assetTitle: string;
	blockId: string;
}) =>
	Effect.gen(function* () {
		const embedResults = yield* Effect.tryPromise({
			try: async () =>
				await embedMany({
					model: getSaiaEmbeddingModel({
						model: "e5-mistral-7b-instruct",
					}).provider,
					values: chunks.map((chunk) => chunk.embeddingContent),
				}),
			catch: toSanitizedPgBossRunError,
		});

		const metaDataChunks = chunks.map((chunk, index) => {
			const basePayload = {
				asset_id: assetId,
				block_id: blockId,
				text: chunk.content,
				title: assetTitle,
				documentTotalPages: chunk.documentTotalPages,
				chunkPageStart: chunk.chunkPageStart,
				chunkPageEnd: chunk.chunkPageEnd,
				depth: chunk.depth,
				tokens: chunk.tokens,
				chunk_index: chunk.chunkIndex,
				chunkCount: chunk.chunkCount,
				createdAt: new Date().toISOString(),
			};

			const specificPayload =
				chunk.source === "image"
					? {
							source: "image" as const,
							file_reference: chunk.fileReference,
							file_type: chunk.fileType,
						}
					: {
							source: "text" as const,
						};

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
			type: "kreuzberg",
			qdrant: qdrantResult,
		};
	});
