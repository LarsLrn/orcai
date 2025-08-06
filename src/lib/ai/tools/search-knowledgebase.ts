import { tool } from "ai";
import { z } from "zod";
import { client } from "@/lib/orpc/orpc";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";

export const searchKnowledgeBaseTool = ({ block }: { block: DatabaseBlock }) =>
	tool({
		description: `ALWAYS base your response on the knowledge base. Use it to find relevant information about the user's query.`,
		inputSchema: z.object({
			query: z.string().describe("The query to search the knowledge base with"),
		}),
		execute: async ({ query }) => {
			const result = await client.assetPoints.list({
				filters: {
					search: query,
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
