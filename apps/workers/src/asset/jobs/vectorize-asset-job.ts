import { countTokens } from "@orcai/ai";
import { DB, dbSchema } from "@orcai/db";
import type { Job } from "@orcai/pg-boss";
import {
	AssetPipelineError,
	claimIndexing,
	completeIndexing,
	currentIndexing,
	type IndexingAttempt,
	indexingAttempt,
	reconcileLinkPoints,
	serveIndexedAttempt,
	settleIndexingAttempt,
	withLinkPoints,
} from "@orcai/preparation";
import {
	readStoredExtraction,
	type StoredExtractionArtifact,
} from "@orcai/process";
import {
	EmbeddingGeneration,
	onActiveGeneration,
	upsertPointsToQdrant,
} from "@orcai/qdrant";
import {
	type FileType,
	isImageFileType,
	type VectorizeAssetPayload,
} from "@orcai/schema";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { v5 as uuidv5 } from "uuid";
import { summarizeErrorCause } from "@/asset/error-summary";

const POINT_ID_NAMESPACE = "3f0d7c2e-5b1a-4d8e-9c6f-2a4b8e1d7f30";

type VectorPointSource = "text" | "image";

type VectorizableChunk = {
	content: string;
	/** The heading path of the chunk, or of its page for an image. */
	section?: string;
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

const extractDocumentTotalPages = (extraction: StoredExtractionArtifact) =>
	toValidPageNumber(
		extraction.metadata.pages?.totalCount ??
			extraction.metadata.pageCount ??
			undefined,
	);

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

/** `content` below its header lines, as a passage is embedded. */
const withHeader = (header: (string | undefined)[], content: string) => {
	const lines = header.filter(Boolean).join("\n");
	return lines ? `${lines}\n\n${content}` : content;
};

/** A text passage is embedded below the asset's title and its section, and matched by keyword below its section alone. */
const buildTextChunks = ({
	extraction,
	title,
}: {
	extraction: StoredExtractionArtifact;
	title: string;
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
		const section = formatHeadingContext(
			chunk.metadata.headingContext ?? undefined,
		);
		const embeddingContent = withHeader(
			[
				title,
				section,
			],
			chunk.content,
		);

		return {
			content: chunk.content,
			section,
			lexicalContent: withHeader(
				[
					section,
				],
				chunk.content,
			),
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

/** A chunk for every image the utility model described, in the section of its page's first text chunk, embedded below the asset's title. */
const buildImageChunks = ({
	extraction,
	textChunks,
	title,
}: {
	extraction: StoredExtractionArtifact;
	textChunks: readonly VectorizableChunk[];
	title: string;
}): VectorizableChunk[] => {
	const textChunkCount = extraction.chunks.length;
	const documentTotalPages = extractDocumentTotalPages(extraction);

	return extraction.images.flatMap((image, imageIndex) => {
		const text = image.text?.trim();
		if (!text || !image.sourcePath) {
			return [];
		}
		const page = toValidPageNumber(image.pageNumber ?? undefined);
		const section =
			page === undefined
				? undefined
				: textChunks.find(
						({ chunkPageStart, chunkPageEnd }) =>
							chunkPageStart !== undefined &&
							chunkPageStart <= page &&
							page <= (chunkPageEnd ?? chunkPageStart),
					)?.section;

		return [
			{
				content: text,
				section,
				lexicalContent: text,
				embeddingContent: withHeader(
					[
						title,
					],
					text,
				),
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

/**
 * The stored extraction. One that is gone, or in a shape this version cannot
 * read, fails `missing_extraction`, which processing prepares again.
 */
const readExtraction = (assetId: IndexingAttempt["assetId"]) =>
	readStoredExtraction(assetId).pipe(
		Effect.mapError(
			(error) =>
				new AssetPipelineError(
					error._tag === "StoredExtractionError"
						? {
								failure: "missing_extraction",
								cause: error,
							}
						: {
								failure: "other",
								cause: summarizeErrorCause(error),
							},
				),
		),
	);

export const vectorizeAsset = (job: Job<VectorizeAssetPayload>) =>
	Effect.gen(function* () {
		const attempt = indexingAttempt(job.data);
		const ran = yield* Effect.exit(
			runAttempt({
				jobId: job.id,
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
				processingStatus: dbSchema.asset.processingStatus,
				title: dbSchema.asset.title,
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

		yield* onActiveGeneration(
			Effect.gen(function* () {
				const { generation } = yield* EmbeddingGeneration;
				if (!(yield* claimIndexing(attempt, generation))) {
					return yield* Effect.logInfo(
						{
							jobId,
							...attempt,
							generation,
						},
						"Skipping an indexing delivery that is done, replaced or for another embedding generation",
					);
				}

				yield* settleIndexingAttempt(
					attempt,
					indexAsset({
						jobId,
						attempt,
						title: asset.title,
					}),
				);
			}),
		).pipe(
			Effect.catchTag("EmbeddingsNotConfiguredError", () =>
				Effect.logInfo(
					{
						jobId,
						...attempt,
					},
					"Indexing waits for the embedding setup",
				),
			),
		);
	});

/**
 * Writes the attempt's points unpublished next to the link's indexed ones in
 * the generation's collection, then completes the attempt and serves them in
 * one step; the reconcile deletes the earlier ones. Point ids follow the attempt and chunk, so deliveries of
 * one attempt write the same points.
 */
const indexAsset = ({
	jobId,
	attempt,
	title,
}: {
	jobId: string;
	attempt: IndexingAttempt;
	/** The asset's title now, which its passages are stored with. */
	title: string;
}) =>
	Effect.gen(function* () {
		const { assetId, blockId } = attempt;

		const extraction = yield* readExtraction(assetId);

		const textChunks = buildTextChunks({
			extraction,
			title,
		});

		const imageChunks = buildImageChunks({
			extraction,
			textChunks,
			title,
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
			title,
		});

		const completed = yield* completeIndexing(attempt);
		if (!completed) {
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
	title,
}: {
	chunks: VectorizableChunk[];
	attempt: IndexingAttempt;
	title: string;
}) =>
	Effect.gen(function* () {
		const { assetId, blockId } = attempt;
		const { embedPassages } = yield* EmbeddingGeneration;
		const vectors = yield* embedPassages(
			chunks.map((chunk) => chunk.embeddingContent),
		);

		const metaDataChunks = chunks.map((chunk, index) => {
			const basePayload = {
				asset_id: assetId,
				block_id: blockId,
				text: chunk.content,
				section: chunk.section,
				document_title: title,
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
				vector: vectors[index],
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
