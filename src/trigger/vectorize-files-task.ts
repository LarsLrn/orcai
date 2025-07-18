import https from "node:https";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { logger, task } from "@trigger.dev/sdk/v3";
import { embedMany, generateText } from "ai";
import nodeFetch from "node-fetch";
import pMap from "p-map";
import { v4 as uuidv4 } from "uuid";
import { getSaiaEmbeddingModel, getSaiaModel } from "@/lib/ai/saia-models";
import type { MarkdownNode } from "@/lib/chunk/markdown-chunker";
import {
	getImageAsBase64,
	getMarkdownAsString,
	listAllFilesInPrefix,
} from "@/lib/s3/file-functions";
import {
	deleteChunksByDocumentId,
	upsertChunksToQdrant,
} from "@/qdrant/mutations";
import { buckets } from "@/settings/buckets";
import {
	describeImagePrompt,
	describeTableImagePrompt,
} from "@/settings/prompts";
import { ROUTES } from "@/settings/routes";
import type { FileType } from "@/types/file";
import type {
	ProcessingStatus,
	VectorizeFilesTaskPayload,
} from "@/types/trigger";

export const vectorizeFilesTask = task({
	id: "vectorize-files-task",
	maxDuration: 1800,
	queue: {
		concurrencyLimit: 1,
	},
	run: async (payload: VectorizeFilesTaskPayload) => {
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
			courseId: payload.courseId,
			documentId: payload.prefix,
		});

		const nextResponse = await logger.trace("update-next-api", async () => {
			const apiUrl = `${process.env.NEXT_PUBLIC_BASE_URL}${ROUTES.API.docs.processing.getPath()}`;
			const requestBody = {
				documentId: payload.documentId,
				courseId: payload.courseId,
				step: "embedding",
				status: "success",
			} as ProcessingStatus;

			logger.info(`Sending processing status update to: ${apiUrl}`);
			logger.info(`Request body: ${JSON.stringify(requestBody)}`);

			try {
				// Create an https agent that ignores SSL errors
				const httpsAgent = new https.Agent({
					rejectUnauthorized: false,
				});

				const response = await nodeFetch(apiUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-api-key": process.env.SOKRATEST_API_KEY || "",
					},
					body: JSON.stringify(requestBody),
					// Use the agent that ignores SSL errors
					agent: apiUrl.startsWith("https") ? httpsAgent : undefined,
				});

				const responseText = await response.text();
				logger.info(`Response status: ${response.status}`);
				logger.info(`Response body: ${responseText}`);

				if (!response.ok) {
					logger.error(
						`Failed API request with status ${response.status}: ${responseText}`,
					);
					throw new Error(
						`Failed to send processing status: ${response.status} - ${responseText}`,
					);
				}

				return response;
			} catch (error) {
				logger.error(
					`Error during API request: ${error instanceof Error ? error.message : String(error)}`,
				);
				logger.error(
					`Stack trace: ${error instanceof Error ? error.stack : "No stack trace"}`,
				);
				throw error;
			}
		});

		return { payload, results: { qdrant: qdrantResponse, next: nextResponse } };
	},
	onFailure: async (payload) => {
		await logger.trace("update-next-api", async () => {
			const apiUrl = `${process.env.NEXT_PUBLIC_BASE_URL}${ROUTES.API.docs.processing.getPath()}`;
			const requestBody = {
				documentId: payload.documentId,
				courseId: payload.courseId,
				step: "embedding",
				status: "error",
			} as ProcessingStatus;

			logger.info(`Sending processing status update to: ${apiUrl}`);
			logger.info(`Request body: ${JSON.stringify(requestBody)}`);

			try {
				// Create an https agent that ignores SSL errors
				const httpsAgent = new https.Agent({
					rejectUnauthorized: false,
				});

				const response = await nodeFetch(apiUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-api-key": process.env.SOKRATEST_API_KEY || "",
					},
					body: JSON.stringify(requestBody),
					// Use the agent that ignores SSL errors
					agent: apiUrl.startsWith("https") ? httpsAgent : undefined,
				});

				const responseText = await response.text();
				logger.info(`Response status: ${response.status}`);
				logger.info(`Response body: ${responseText}`);

				if (!response.ok) {
					logger.error(
						`Failed API request with status ${response.status}: ${responseText}`,
					);
					throw new Error(
						`Failed to send processing status: ${response.status} - ${responseText}`,
					);
				}

				return response;
			} catch (error) {
				logger.error(
					`Error during API request: ${error instanceof Error ? error.message : String(error)}`,
				);
				logger.error(
					`Stack trace: ${error instanceof Error ? error.stack : "No stack trace"}`,
				);
				throw error;
			}
		});
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
	courseId,
	documentId,
}: {
	chunks: MarkdownNode[];
	courseId: string;
	documentId: string;
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
			course_id: courseId,
			document_id: documentId,
			text: embedResults.values[index],
			title: chunk.title,
			depth: chunk.depth,
			tokens: chunk.length,
			chunkIndex: index,
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
		async () => await deleteChunksByDocumentId({ courseId, documentId }),
	);

	// Save to Qdrant
	const qdrantResult = await logger.trace(
		"save-embeddings",
		async () =>
			await upsertChunksToQdrant({
				chunks: metaDataChunks,
			}),
	);

	return { success: true, type: "markdown", qdrant: qdrantResult };
};
