import { TokenChunker } from "@chonkiejs/core";
import { embedMany, generateText } from "ai";
import * as Effect from "effect/Effect";
import type { Job } from "pg-boss";
import { v4 as uuidv4 } from "uuid";
import { getSaiaEmbeddingModel, getSaiaModel } from "@/lib/ai/saia-models";
import type { MarkdownNode } from "@/lib/chunk/markdown-chunker";
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

const vectorizeAssetsEffect = (params: { job: Job<VectorizeAssetPayload> }) =>
	Effect.gen(function* () {
		const { prefix, blockId, assetId } = params.job.data;

		const { Contents: files } = yield* sendListObjectsCommand({
			bucket: buckets.processed.name,
			prefix: `${prefix}/`,
		});

		if (!files || files.length === 0) {
			yield* Effect.logWarning(
				{
					prefix,
				},
				"No files found for asset, skipping vectorization",
			);
			return;
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
							"png",
						].includes(fileExtension) &&
						name
					) {
						const image = yield* getImageAsBase64({
							bucket: buckets.processed.name,
							name,
						});

						const processedImage = yield* processImageFile(
							image,
							name,
							fileExtension as FileType,
						);

						if (processedImage) {
							images.push(processedImage);
						}
					} else {
						yield* Effect.logWarning(
							{
								fileName: name,
							},
							"Unsupported file type, skipping",
						);
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

		yield* Effect.logInfo(
			{
				chunkCount: mergedChunks.length,
				markdownCount: markdown.length,
				imageCount: imageChunks.length,
			},
			"Generated chunks for asset",
		);

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

const processMarkdownFile = ({
	fileContent,
	fileName,
}: {
	fileContent: string;
	fileName: string;
}) =>
	Effect.gen(function* () {
		const page = extractPageFromFileName(fileName);
		const title =
			page !== undefined ? `${fileName} (page ${String(page + 1)})` : fileName;

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
		);
	});

const processImageFile = (
	base64Image: string,
	name: string,
	fileExtension: FileType,
) =>
	Effect.gen(function* () {
		const mimeType = `image/${fileExtension}`;
		const imageType = name.startsWith("table") ? "table" : "picture";
		const dataUrl = `data:${mimeType};base64,${base64Image}`;

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
									image: dataUrl,
								},
							],
						},
					],
				}),
			catch: (cause) =>
				new PgBossError({
					operation: "run",
					cause,
				}),
		}).pipe(
			Effect.map((result) => ({
				description: result.text,
				tokens: result.usage.totalTokens,
				name,
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
			catch: (cause) =>
				new PgBossError({
					operation: "run",
					cause,
				}),
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
