import { tool } from "ai";
import { z } from "zod/v4";
import { client } from "@/lib/orpc/orpc";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";

export const searchKnowledgeBaseTool = ({ block }: { block: DatabaseBlock }) =>
	tool({
		description: `ALWAYS base your response on the knowledge base. Use it to find relevant information about the user's message. If the results returned are not relevant, try to rephrase the query and search again. NEVER make up information that is not in the knowledge base. If you cannot find relevant information, respond with "I don't know". Formulate long and detailed queries to get the best results. Expand abbreviations where possible.`,
		inputSchema: z.object({
			query: z
				.string()
				.describe("The query to search the knowledge base with."),
			detailedQuery: z
				.string()
				.describe(
					"A more detailed version of the query with expanded abbreviations. Keep it precise yet detailed.",
				),
			limit: z.coerce
				.number()
				.max(block.config.maxReferences)
				.min(block.config.minReferences)
				.describe("The number of results to return.")
				.default(block.config.defaultReferences),
		}),
		execute: async ({ limit, detailedQuery }) => {
			const result = await client.assetPoints.list({
				filters: {
					search: detailedQuery,
					limit: limit,
					blockId: block.id,
				},
			});

			const chunks = result.data
				.filter((point) => point.score > 0.5)
				.map((point) => ({
					id: point.id,
					score: point.score,
					title: point.payload.title,
					text: point.payload.text,
				}));

			return {
				result: chunks,
			};
		},
	});
