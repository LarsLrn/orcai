import { createOpenAI } from "@ai-sdk/openai";
import {
	type DataStreamWriter,
	experimental_generateImage,
	generateText,
	tool,
} from "ai";
import { z } from "zod";
import { getSaiaModel } from "@/lib/ai/saia-models";

export const generateImageTool = ({
	dataStream,
	assistantMessageId,
}: {
	dataStream: DataStreamWriter;
	assistantMessageId: string;
}) =>
	tool({
		description: "Generate an image based on a text prompt",
		parameters: z.object({
			prompt: z
				.string()
				.describe(
					"The prompt to generate the image from. If the user requests a revision of a previous image, inspect the 'description' field of the image in question, combined with the original prompt as 'prompt'.",
				),
		}),
		execute: async ({ prompt }) => {
			const openai = createOpenAI({
				baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL,
				apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
				name: "chatAi",
				compatibility: "compatible",
			});

			const { image } = await experimental_generateImage({
				model: openai.image("flux"),
				prompt,
			});

			const description = await generateText({
				model: getSaiaModel({
					input: ["image"],
					model: "qwen2.5-vl-72b-instruct",
				}).provider,
				// maxTokens: 1024,
				system: `You are passed an AI generated image. Write a highly detailed description of the image and what it shows. Include a description of all elements, their position, color, and composition. Output ONLY the description, nothing else. Do not start your response with "This image shows..." or something like that. Simply start with the description.`,
				messages: [
					{
						role: "user",
						content: [
							{
								type: "image",
								image: `data:image/png;base64,${image.base64}`,
							},
						],
					},
				],
			});

			dataStream.writeData({
				type: "image",
				image: image.base64,
				prompt,
				messageId: assistantMessageId, // Associate with the current message
			});

			// Return only a summary for the LLM context, not the full image data
			return {
				imageGenerated: true,
				prompt,
				description: description.text,
				nextAction:
					"Successfully generated an image. The image has been displayed to the user already. Do not attempt to return the image itself. Simply acknowledge that the image was generated and provide a brief description.",
			};
		},
	});
