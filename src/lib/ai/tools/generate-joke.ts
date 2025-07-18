import { generateText, tool } from "ai";
import { z } from "zod";
import { getSaiaModel } from "@/lib/ai/saia-models";

export const generateJokeTool = () =>
	tool({
		description: "Generate a joke based on a text prompt",
		inputSchema: z.object({
			topic: z.string().describe("The topic or theme for the joke"),
			style: z
				.string()
				.optional()
				.describe("The style of joke (e.g., pun, one-liner, story)"),
		}),
		execute: async ({ topic, style }) => {
			console.log("Generating joke with topic:", topic, "and style:", style);

			const response = await generateText({
				model: getSaiaModel({
					input: ["text"],
					model: "meta-llama-3.1-8b-instruct",
				}).provider,
				prompt: `Generate a funny ${style} joke about ${topic}. Make it clever and appropriate. Just return the joke, nothing else.`,
			});

			return {
				joke: response.text,
				topic,
				style,
				model: "meta-llama-3.1-8b-instruct",
			};
		},
	});
