import { RecursiveChunker } from "@chonkiejs/core";
import { embedMany, generateText } from "ai";
import pMap from "p-map";
import type { Job } from "pg-boss";
import { v4 as uuidv4 } from "uuid";
import { getSaiaEmbeddingModel, getSaiaModel } from "@/lib/ai/saia-models";
import type { MarkdownNode } from "@/lib/chunk/markdown-chunker";
import type { Asset } from "@/lib/orpc/schemas/asset";
import type { Block } from "@/lib/orpc/schemas/block";
import type { VectorizeAssetPayload } from "@/lib/pg-boss/schema/vectorize-asset";
import {
	getImageAsBase64,
	getMarkdownAsString,
	listAllFilesInPrefix,
} from "@/lib/s3/file-functions";
import type { FileType } from "@/lib/s3/schema/file-schema";
import {
	deletePointsByIdentifier,
	upsertPointsToQdrant,
} from "@/qdrant/mutations";
import { buckets } from "@/settings/buckets";
import {
	describeImagePrompt,
	describeTableImagePrompt,
} from "@/settings/prompts";

export const VECTORIZE_ASSET_JOB_NAME = "vectorize-asset-job";

export async function handleVectorizeAssetJob(
	jobs: Job<VectorizeAssetPayload>[],
) {
	for (const job of jobs) {
		const { prefix, blockId, assetId, mergePages } = job.data;

		const files = await listAllFilesInPrefix({
			bucket: buckets.processed.name,
			prefix: `${prefix}/`,
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
					chunkingStrategy: mergePages
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
				console.info(`Skipping unsupported file type: ${fileExtension}`, {
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
			assetId: prefix,
			blockId,
		});

		return {
			payload: {
				assetId,
				blockId,
			},
			results: { qdrant: qdrantResponse },
		};
	}
}

const processMarkdownFile = async ({
	fileContent,
	fileName,
	chunkingStrategy,
}: {
	fileContent: string;
	fileName: string;
	chunkingStrategy: "none" | "RecursiveCharacterTextSplitter";
}) => {
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

	const chunker = await RecursiveChunker.create({
		chunkSize: 2048,
	});

	const chunks = await chunker.chunk(fileContent);

	const nodes = chunks.map((chunk) => ({
		title: fileName,
		depth: 0,
		content: chunk.text,
		length: chunk.tokenCount,
		type: "text",
	})) as MarkdownNode[];

	return nodes;
};

const processImageFile = async (
	base64Image: string,
	name: string,
	fileExtension: FileType,
) => {
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
	const embedResults = await embedMany({
		model: getSaiaEmbeddingModel({ model: "e5-mistral-7b-instruct" }).provider,
		values: chunks.map((chunk) => chunk.content),
	});

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

	await deletePointsByIdentifier({ assetId, blockId });

	const qdrantResult = await upsertPointsToQdrant({
		points: metaDataChunks,
	});

	return { success: true, type: "markdown", qdrant: qdrantResult };
};
