import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { AiError, generateTextEffect } from "@orcai/ai";
import type { ImageGenerationBlock } from "@orcai/schema";
import { generateImage, tool, type UIMessageStreamWriter } from "ai";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { streamErrorReason } from "@/lib/ai/utils/stream-error-reason";
import { runPromise } from "@/lib/effect/runtime";
import { BadRequestError } from "@/lib/effect/utils/errors";
import { providerApiKey } from "@/lib/encryption";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { modelProcedures } from "@/lib/orpc/router/model";
import { providerProcedures } from "@/lib/orpc/router/provider";

export const generateImageTool = ({
	writer,
	block,
	context,
}: {
	writer: UIMessageStreamWriter;
	block: ImageGenerationBlock;
	organizationId: string;
	context: ORPCContext;
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
		execute: async ({ prompt }, { abortSignal }) =>
			runPromise(
				Effect.gen(function* () {
					const [{ data: provider }, { data: model }] = yield* Effect.all(
						[
							providerProcedures
								.find(
									{
										id: block.config.provider,
									},
									{
										context,
									},
								)
								.pipe(
									Effect.mapError(
										(cause) =>
											new AiError({
												operation: "generateImageTool.fetch.provider",
												cause,
											}),
									),
								),
							modelProcedures
								.find(
									{
										id: block.config.model,
									},
									{
										context,
									},
								)
								.pipe(
									Effect.mapError(
										(cause) =>
											new AiError({
												operation: "generateImageTool.fetch.model",
												cause,
											}),
									),
								),
						],
						{
							concurrency: "unbounded",
						},
					);

					if (model.providerId !== provider.id) {
						return yield* new BadRequestError({
							reason: "MODEL_PROVIDER_MISMATCH",
							message: "Selected model does not belong to selected provider.",
						});
					}

					if (!provider.enabled) {
						return yield* new BadRequestError({
							reason: "PROVIDER_DISABLED",
							message:
								"Selected provider is disabled. Please choose an active provider.",
						});
					}

					if (model.isDeprecated) {
						return yield* new BadRequestError({
							reason: "MODEL_DEPRECATED",
							message:
								"Selected model is deprecated. Please choose a non-deprecated model.",
						});
					}

					const apiKey = yield* providerApiKey(provider.id);

					const providerInstance = createOpenAICompatible({
						baseURL: provider.endpoint ?? "", // TODO: Fix?
						apiKey,
						name: provider.name,
						includeUsage: true,
					});

					const { image } = yield* Effect.tryPromise({
						try: (signal) =>
							generateImage({
								model: providerInstance.imageModel(block.config.model),
								prompt: `${block.config.prompt}\n\n${prompt}`,
								abortSignal: signal,
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
				{
					signal: abortSignal,
				},
			).catch((error: unknown) => {
				throw new Error(streamErrorReason(error, "AI_TOOL_FAILED"), {
					cause: error,
				});
			}),
	});
