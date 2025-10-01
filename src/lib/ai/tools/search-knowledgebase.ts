import { tool } from "ai";
import { z } from "zod/v4";
import { client } from "@/lib/orpc/orpc";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";

export const searchKnowledgeBaseTool = ({ block }: { block: DatabaseBlock }) =>
	tool({
		description: `ALWAYS base your response on the knowledge base. Use it to find relevant information about the user's query. If the results returned are not relevant, try to rephrase the query and search again. NEVER make up information that is not in the knowledge base. If you cannot find relevant information, respond with "I don't know".`,
		inputSchema: z.object({
			query: z
				.string()
				.describe(
					"The query to search the knowledge base with. If not directly specified, should be a summary of the conversation so far, focusing on the user's intent.",
				),
			limit: z
				.number()
				.max(block.config.maxReferences)
				.min(block.config.minReferences)
				.describe("The number of results to return.")
				.default(block.config.defaultReferences),
		}),
		execute: async ({ query, limit }) => {
			const result = await client.assetPoints.list({
				filters: {
					search: query,
					limit: limit,
					blockId: block.id,
				},
			});

			const chunks = result.data.map((point) => ({
				id: point.id,
				text: point.payload.text,
			}));

			return {
				result: chunks,
			};
		},
	});
