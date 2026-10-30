import { countTokens, generateManyEmbeddings } from "@orcai/ai";
import type { AssetId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	type Job,
	reconcileLinkPoints,
	serveIndexedAttempt,
	settleStage,
	withLinkPoints,
} from "@orcai/pg-boss";
import type { StoredExtractionArtifact } from "@orcai/process";
import { upsertPointsToQdrant } from "@orcai/qdrant";
import {
	type AssetFileType,
	type BucketName,
	type FileType,
	isImageFileType,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { v5 as uuidv5 } from "uuid";
import { describedExtraction } from "@/asset/described-extraction";
import {
	AssetPipelineError,
	claimIndexing,
	currentIndexing,
	type IndexingAttempt,
	indexingAttempt,
	settleIndexingAttempt,
} from "@/asset/pipeline-attempt";

const POINT_ID_NAMESPACE = "3f0d7c2e-5b1a-4d8e-9c6f-2a4b8e1d7f30";

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

/**
 * The link while `attempt` may write points: its current, unfinished
 * indexing, newer than the indexed one.
 */
const stagingLink = (attempt: IndexingAttempt) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { blockAsset } = dbSchema;
		const [link] = yield* db
			.select({
				indexed: blockAsset.indexedAttempt,
			})
			.from(blockAsset)
			.where(
				and(
					currentIndexing(attempt),
					or(
						isNull(blockAsset.indexedAttempt),
						lt(blockAsset.indexedAttempt, attempt.attempt),
					),
				),
			);
		return link;
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
	bucket: BucketName;
	prefix: string;
	fileType: AssetFileType;
}

const vectorizeAssets = (params: { job: Job<VectorizeAssetPayload> }) =>
	Effect.gen(function* () {
		const attempt = indexingAttempt(params.job.data);
		const ran = yield* Effect.exit(
			runAttempt({
				jobId: params.job.id,
				attempt,
			}),
		);
		// Every delivery reconciles, skipped ones too; a failed reconcile fails the job so a retry runs it again.
		yield* reconcileLinkPoints(attempt);
		return yield* ran;
	});

const runAttempt = (params: { jobId: string; attempt: IndexingAttempt }) =>
	Effect.gen(function* () {
		const { jobId, attempt } = params;
		const db = yield* DB;

		const [asset] = yield* db
			.select({
				id: dbSchema.asset.id,
				bucket: dbSchema.asset.bucket,
				prefix: dbSchema.asset.prefix,
				fileType: dbSchema.asset.fileType,
				processingStatus: dbSchema.asset.processingStatus,
			})
			.from(dbSchema.asset)
			.where(eq(dbSchema.asset.id, attempt.assetId));

		if (!asset) {
			return yield* Effect.logInfo(
				{
					jobId,
					assetId: attempt.assetId,
				},
				"Skipping vectorization of a deleted asset",
			);
		}

		if (asset.processingStatus !== "completed") {
			return yield* Effect.logInfo(
				{
					jobId,
					assetId: attempt.assetId,
					processingStatus: asset.processingStatus,
				},
				"Skipping vectorization; processing queues it again once it completes",
			);
		}

		if (!(yield* claimIndexing(attempt))) {
			return yield* Effect.logInfo(
				{
					jobId,
					...attempt,
				},
				"Skipping an indexing delivery that is done or replaced",
			);
		}

		yield* settleIndexingAttempt(
			attempt,
			indexAsset({
				jobId,
				asset,
				attempt,
			}),
		);
	});

/**
 * Writes the attempt's points unpublished next to the link's indexed ones,
 * then completes the attempt and serves them in one step; the reconcile
 * deletes the earlier ones. Point ids follow the attempt and chunk, so deliveries of
 * one attempt write the same points.
 */
const indexAsset = (params: {
	jobId: string;
	asset: IndexedAsset;
	attempt: IndexingAttempt;
}) =>
	Effect.gen(function* () {
		const { jobId, attempt } = params;
		const { assetId, blockId } = attempt;
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

		if (!(yield* stagingLink(attempt))) {
			return yield* Effect.logInfo(
				{
					jobId,
					...attempt,
				},
				"Skipping vector upsert of an indexing attempt that was replaced",
			);
		}

		yield* embedChunks({
			chunks: mergedChunks,
			attempt,
		});

		// Served before the commit, so a link never reads indexed without its points.
		const completed = yield* withLinkPoints(
			attempt,
			Effect.gen(function* () {
				const written = yield* db
					.update(dbSchema.blockAsset)
					.set({
						indexStatus: "completed",
						indexFailure: null,
						indexedAttempt: attempt.attempt,
					})
					.where(currentIndexing(attempt))
					.returning({
						assetId: dbSchema.blockAsset.assetId,
					});
				if (written.length > 0) {
					yield* settleStage(
						attempt.runId,
						{
							stage: "indexing",
							assetId,
							blockId,
						},
						{
							state: "completed",
						},
					);
					yield* serveIndexedAttempt(attempt, attempt.attempt);
				}
				return written;
			}),
		);
		if (completed.length === 0) {
			yield* Effect.logInfo(
				{
					jobId,
					...attempt,
				},
				"Not completing an indexing attempt that was replaced",
			);
		}
	});

const embedChunks = ({
	chunks,
	attempt,
}: {
	chunks: VectorizableChunk[];
	attempt: IndexingAttempt;
}) =>
	Effect.gen(function* () {
		const { assetId, blockId } = attempt;
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
				documentTotalPages: chunk.documentTotalPages,
				chunkPageStart: chunk.chunkPageStart,
				chunkPageEnd: chunk.chunkPageEnd,
				depth: chunk.depth,
				tokens: chunk.tokens,
				chunk_index: chunk.chunkIndex,
				chunkCount: chunk.chunkCount,
				createdAt: new Date().toISOString(),
				index_attempt: attempt.attempt,
				published: false,
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
				id: uuidv5(
					`${assetId}/${blockId}/${attempt.attempt}/${index}`,
					POINT_ID_NAMESPACE,
				),
				vector: embedResults.embeddings[index],
				payload: {
					...basePayload,
					...specificPayload,
				},
			};
		});

		// Checked again under the lock, so no write lands after the link's reconcile moved past this attempt.
		yield* withLinkPoints(
			attempt,
			Effect.gen(function* () {
				const link = yield* stagingLink(attempt);
				if (!link) {
					return yield* Effect.logInfo(
						attempt,
						"Skipping vector upsert of an indexing attempt that is done or replaced",
					);
				}
				// A completion that did not commit may serve these points in place of the indexed ones.
				yield* serveIndexedAttempt(attempt, link.indexed);
				yield* upsertPointsToQdrant({
					points: metaDataChunks,
				});
			}),
		);
	});
