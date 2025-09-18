import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { logger, task } from "@trigger.dev/sdk";
import { embedMany, generateText } from "ai";
import pMap from "p-map";
import { v4 as uuidv4 } from "uuid";
import { getSaiaEmbeddingModel, getSaiaModel } from "@/lib/ai/saia-models";
import type { MarkdownNode } from "@/lib/chunk/markdown-chunker";
import type { Asset } from "@/lib/orpc/schemas/asset";
import type { Block } from "@/lib/orpc/schemas/block";
import {
	getImageAsBase64,
	getMarkdownAsString,
	listAllFilesInPrefix,
} from "@/lib/s3/file-functions";
import {
	deletePointsByIdentifier,
	upsertPointsToQdrant,
} from "@/qdrant/mutations";
import { buckets } from "@/settings/buckets";
import {
	describeImagePrompt,
	describeTableImagePrompt,
} from "@/settings/prompts";
import type { FileType } from "@/types/file";
import type { VectorizeAssetTaskPayload } from "@/types/trigger";

export const vectorizeAssetTask = task({
	id: "vectorize-asset-task",
	maxDuration: 1800,
	queue: {
		name: "processing-embeddings-queue",
		concurrencyLimit: 1,
	},
	run: async (payload: VectorizeAssetTaskPayload) => {
		const files = await listAllFilesInPrefix({
			bucket: buckets.processed.name,
			prefix: `${payload.prefix}/`,
		});

		const images: {
			description: string;
			tokens: number | undefined;
			name: string;
			type: FileType;
		}[] = [];

		const markdown: MarkdownNode[] = [];

		const processFile = async (file: {
			name: string;
			lastModified?: Date;
			size?: number;
		}) => {
			const fileExtension = file.name.split(".").pop()?.toLowerCase();
			if (!fileExtension) {
				return;
			}
			if (fileExtension === "md") {
				const text = (await getMarkdownAsString({
					bucket: buckets.processed.name,
					name: file.name,
				})) as string;

				const processedMarkdown = await processMarkdownFile({
					fileContent: text,
					fileName: file.name,
					chunkingStrategy: payload.mergePages
						? "RecursiveCharacterTextSplitter"
						: "none",
				});

				markdown.push(...processedMarkdown);
			} else if (["jpeg", "png"].includes(fileExtension)) {
				// TODO: Expand supported file types, centralised with upload formats
				const image = await getImageAsBase64({
					bucket: buckets.processed.name,
					name: file.name,
				});

				const processedImage = await processImageFile(
					image,
					file.name,
					fileExtension as FileType,
				);

				if (processedImage) {
					images.push(processedImage);
				}
			} else {
				logger.info(`Skipping unsupported file type: ${fileExtension}`, {
					fileName: file.name,
				});
			}
		};

		await pMap(files, processFile, { concurrency: 2 });

		const imageChunks = images.map((image) => ({
			content: image.description,
			depth: 0,
			length: image.tokens,
			title: image.name,
			type: "image",
		})) as MarkdownNode[];

		const mergedChunks = [...markdown, ...imageChunks];

		console.log("Merged chunks:", mergedChunks);

		const qdrantResponse = await generateEmbeddings({
			chunks: mergedChunks,
			assetId: payload.prefix,
			blockId: payload.blockId,
		});

		return { payload, results: { qdrant: qdrantResponse } };
	},
});

const processMarkdownFile = async ({
	fileContent,
	fileName,
	chunkingStrategy,
}: {
	fileContent: string;
	fileName: string;
	chunkingStrategy: "none" | "RecursiveCharacterTextSplitter";
}) => {
	return await logger.trace(`process-markdown-${fileName}`, async () => {
		if (chunkingStrategy === "none") {
			return [
				{
					title: fileName,
					depth: 0,
					content: fileContent,
					length: fileContent.length,
					type: "text",
				},
			] as MarkdownNode[];
		}

		const splitter = new RecursiveCharacterTextSplitter({
			chunkSize: 1024,
			chunkOverlap: 128,
		});

		const parsedDocuments = await splitter.splitText(fileContent);

		const chunks = parsedDocuments.map((chunk) => ({
			title: "title",
			depth: 0,
			content: chunk,
			length: chunk.length,
			type: "text",
		})) as MarkdownNode[];

		return chunks;
	});
};

const processImageFile = async (
	base64Image: string,
	name: string,
	fileExtension: FileType,
) => {
	return await logger.trace(`process-image-${name}`, async () => {
		const mimeType = `image/${fileExtension}`;
		const imageType = name.startsWith("table") ? "table" : "picture";

		const dataUrl = `data:${mimeType};base64,${base64Image}`;

		const result = await generateText({
			model: getSaiaModel({
				input: ["image"],
				model: "gemma-3-27b-it",
			}).provider,
			maxOutputTokens: 1024,
			system:
				imageType === "table" ? describeTableImagePrompt : describeImagePrompt,
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
		});

		/* const step = result.steps.find((step) => step. === "initial"); */
		/* const imageRef = extractFileInfoFromReference(name)?.id; */

		/* if (!step) return; */

		return {
			description: result.text,
			tokens: result.usage.totalTokens,
			name,
			type: mimeType.split("/")[1] as FileType,
		};
	});
};

const generateEmbeddings = async ({
	chunks,
	assetId,
	blockId,
}: {
	chunks: MarkdownNode[];
	assetId: Asset["id"];
	blockId: Block["id"];
}) => {
	// Embed the chunks
	const embedResults = await logger.trace("embed-chunks", async () =>
		embedMany({
			model: getSaiaEmbeddingModel({ model: "e5-mistral-7b-instruct" })
				.provider,
			values: chunks.map((chunk) => chunk.content),
		}),
	);

	// Create metadata for each chunk
	const metaDataChunks = chunks.map((chunk, index) => {
		// Create the base payload properties common to both types
		const basePayload = {
			asset_id: assetId,
			block_id: blockId,
			text: embedResults.values[index],
			title: chunk.title,
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

	await logger.trace(
		"delete-existing-embeddings",
		async () => await deletePointsByIdentifier({ assetId, blockId }),
	);

	// Save to Qdrant
	const qdrantResult = await logger.trace(
		"save-embeddings",
		async () =>
			await upsertPointsToQdrant({
				points: metaDataChunks,
			}),
	);

	return { success: true, type: "markdown", qdrant: qdrantResult };
};
