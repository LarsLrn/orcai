import { countTokens, generateManyEmbeddings } from "@orcai/ai";
import type { AssetId, BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { Job } from "@orcai/pg-boss";
import type { StoredExtractionArtifact } from "@orcai/process";
import { deletePointsByIdentifier, upsertPointsToQdrant } from "@orcai/qdrant";
import {
	type AssetFileType,
	type BucketName,
	type FileType,
	isImageFileType,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import { describedExtraction } from "@/asset/described-extraction";
import {
	AssetPipelineError,
	settleIndexingAttempt,
} from "@/asset/pipeline-failure";

export const vectorizeAssetBatch = (jobs: Job<VectorizeAssetPayload>[]) =>
	Effect.forEach(
		jobs,
		(job) =>
			vectorizeAssets({
				job,
			}),
		{
			discard: true,
		},
	);

type VectorPointSource = "text" | "image";

type VectorizableChunk = {
	content: string;
	lexicalContent: string;
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

const isAssetAttachedToBlock = (params: {
	assetId: AssetId;
	blockId: BlockId;
}) =>
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

const imageFileType = (format: string) => {
	const normalized = format.toLowerCase();
	return isImageFileType(normalized) ? normalized : undefined;
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
			lexicalContent: embeddingContent,
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

/** A chunk for every image the utility model described. */
const buildImageChunks = (
	extraction: StoredExtractionArtifact,
): VectorizableChunk[] => {
	const textChunkCount = extraction.chunks.length;
	const documentTotalPages = extractDocumentTotalPages(extraction);

	return extraction.images.flatMap((image, imageIndex) => {
		const text = image.text?.trim();
		if (!text || !image.sourcePath) {
			return [];
		}
		const page = toValidPageNumber(image.pageNumber ?? undefined);

		return [
			{
				content: text,
				lexicalContent: text,
				embeddingContent: text,
				tokens: countTokens(text),
				documentTotalPages,
				chunkPageStart: page,
				chunkPageEnd: page,
				depth: 0,
				chunkIndex: textChunkCount + imageIndex,
				chunkCount: textChunkCount + extraction.images.length,
				source: "image",
				fileReference: image.sourcePath,
				fileType: imageFileType(image.format),
			},
		];
	});
};

interface IndexedAsset {
	id: AssetId;
	title: string;
	bucket: BucketName;
	prefix: string;
	fileType: AssetFileType;
}

const vectorizeAssets = (params: { job: Job<VectorizeAssetPayload> }) =>
	Effect.gen(function* () {
		const { blockId, assetId } = params.job.data;
		const db = yield* DB;

		const [asset] = yield* db
			.select({
				id: dbSchema.asset.id,
				title: dbSchema.asset.title,
				bucket: dbSchema.asset.bucket,
				prefix: dbSchema.asset.prefix,
				fileType: dbSchema.asset.fileType,
				processingStatus: dbSchema.asset.processingStatus,
			})
			.from(dbSchema.asset)
			.where(eq(dbSchema.asset.id, assetId));

		if (!asset) {
			return yield* Effect.logInfo(
				{
					jobId: params.job.id,
					assetId,
				},
				"Skipping vectorization of a deleted asset",
			);
		}

		if (asset.processingStatus !== "completed") {
			return yield* Effect.logInfo(
				{
					jobId: params.job.id,
					assetId,
					processingStatus: asset.processingStatus,
				},
				"Skipping vectorization; processing queues it again once it completes",
			);
		}

		const isInitiallyAttached = yield* isAssetAttachedToBlock({
			assetId,
			blockId,
		});

		if (!isInitiallyAttached) {
			return yield* Effect.logInfo(
				{
					jobId: params.job.id,
					assetId,
					blockId,
				},
				"Skipping stale vectorization job for detached asset",
			);
		}

		yield* settleIndexingAttempt(
			{
				assetId,
				blockId,
			},
			indexAsset({
				jobId: params.job.id,
				asset,
				blockId,
			}),
		);
	});

const indexAsset = (params: {
	jobId: string;
	asset: IndexedAsset;
	blockId: BlockId;
}) =>
	Effect.gen(function* () {
		const { jobId, blockId } = params;
		const assetId = params.asset.id;
		const db = yield* DB;

		const extraction = yield* describedExtraction(params);
		if (!extraction) {
			return;
		}

		const textChunks = buildTextChunks({
			extraction,
		});

		const imageChunks = buildImageChunks(extraction);

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
			return yield* new AssetPipelineError({
				failure: "empty",
				cause: new Error(
					`No vectorizable chunks generated for asset ${assetId} in block ${blockId}`,
				),
			});
		}

		const isStillAttached = yield* isAssetAttachedToBlock({
			assetId,
			blockId,
		});

		if (!isStillAttached) {
			return yield* Effect.logInfo(
				{
					jobId,
					assetId,
					blockId,
				},
				"Skipping vector upsert because asset was detached during processing",
			);
		}

		yield* embedChunks({
			chunks: mergedChunks,
			assetId,
			assetTitle: params.asset.title,
			blockId,
		});

		yield* db
			.update(dbSchema.blockAsset)
			.set({
				indexStatus: "completed",
				indexFailure: null,
			})
			.where(
				and(
					eq(dbSchema.blockAsset.assetId, assetId),
					eq(dbSchema.blockAsset.blockId, blockId),
				),
			);
	});

const embedChunks = ({
	chunks,
	assetId,
	assetTitle,
	blockId,
}: {
	chunks: VectorizableChunk[];
	assetId: AssetId;
	assetTitle: string;
	blockId: BlockId;
}) =>
	Effect.gen(function* () {
		const embedResults = yield* generateManyEmbeddings({
			values: chunks.map((chunk) => chunk.embeddingContent),
		});

		const metaDataChunks = chunks.map((chunk, index) => {
			const basePayload = {
				asset_id: assetId,
				block_id: blockId,
				text: chunk.content,
				lexical_text:
					chunk.lexicalContent !== chunk.content
						? chunk.lexicalContent
						: undefined,
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
