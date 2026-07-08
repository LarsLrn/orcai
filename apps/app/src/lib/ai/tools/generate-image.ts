import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { AiError, generateTextEffect } from "@orcai/ai";
import type { ImageGenerationBlock } from "@orcai/schema";
import { generateImage, tool, type UIMessageStreamWriter } from "ai";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { runtime } from "@/lib/effect/runtime";
import { BadRequestError } from "@/lib/effect/utils/errors";
import { decryptApiKey } from "@/lib/encryption";
import { client } from "@/lib/orpc/orpc";

export const generateImageTool = ({
	writer,
	block,
}: {
	writer: UIMessageStreamWriter;
	block: ImageGenerationBlock;
	organizationId: string;
}) =>
	tool({
		description: "Generate an image based on a text prompt",
		inputSchema: z.object({
			prompt: z
				.string()
				.describe(
					"The prompt to generate the image from. If the user requests a revision of a previous image, inspect the 'description' field of the image in question, combined with the original prompt as 'prompt'.",
				),
		}),
		execute: async ({ prompt }) =>
			runtime.runPromise(
				Effect.gen(function* () {
					const [{ data: provider }, { data: model }] = yield* Effect.all(
						[
							Effect.tryPromise({
								try: () =>
									client.provider.find({
										id: block.config.provider,
									}),
								catch: (cause) =>
									new AiError({
										operation: "generateImageTool.fetch.provider",
										cause,
									}),
							}),
							Effect.tryPromise({
								try: () =>
									client.model.find({
										id: block.config.model,
									}),
								catch: (cause) =>
									new AiError({
										operation: "generateImageTool.fetch.model",
										cause,
									}),
							}),
						],
						{
							concurrency: "unbounded",
						},
					);

					if (model.providerId !== provider.id) {
						return yield* new BadRequestError({
							message: "Selected model does not belong to selected provider.",
						});
					}

					if (!provider.enabled) {
						return yield* new BadRequestError({
							message:
								"Selected provider is disabled. Please choose an active provider.",
						});
					}

					if (model.isDeprecated) {
						return yield* new BadRequestError({
							message:
								"Selected model is deprecated. Please choose a non-deprecated model.",
						});
					}

					const apiKey = yield* decryptApiKey(provider.apiKeyEncrypted);

					const providerInstance = createOpenAICompatible({
						baseURL: provider.endpoint ?? "", // TODO: Fix?
						apiKey,
						name: provider.name,
						includeUsage: true,
					});

					const { image } = yield* Effect.tryPromise({
						try: () =>
							generateImage({
								model: providerInstance.imageModel(block.config.model),
								prompt: `${block.config.prompt}\n\n${prompt}`,
							}),
						catch: (cause) =>
							new AiError({
								operation: "generateImageTool.generateImage",
								cause,
							}),
					});

					const description = yield* generateTextEffect({
						instructions: `You are passed an AI generated image. Write a highly detailed description of the image and what it shows. Include a description of all elements, their position, color, and composition. Output ONLY the description, nothing else. Do not start your response with "This image shows..." or something like that. Simply start with the description.`,
						messages: [
							{
								role: "user",
								content: [
									{
										type: "file",
										data: `data:image/png;base64,${image.base64}`,
										mediaType: "image",
									},
								],
							},
						],
					});

					writer.write({
						type: "file",
						mediaType: "image/png",
						url: `data:image/png;base64,${image.base64}`,
					});

					// Return only a summary for the LLM context, not the full image data
					return {
						imageGenerated: true,
						prompt,
						description: description.text,
						nextAction:
							"Successfully generated an image. The image has been displayed to the user already. Do not attempt to return the image itself. Simply acknowledge that the image was generated and provide a brief description.",
					};
				}),
			),
	});
