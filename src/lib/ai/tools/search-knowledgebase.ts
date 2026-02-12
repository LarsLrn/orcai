import { tool } from "ai";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { AiError } from "@/lib/effect/utils/errors";
import { client } from "@/lib/orpc/orpc";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";

export const searchKnowledgeBaseTool = ({ block }: { block?: DatabaseBlock }) =>
	tool({
		description: `Base your response on the knowledge base. Use it to find relevant information about the user's message. If the results returned are not relevant, try to rephrase the query and search again. NEVER make up information that is not in the knowledge base. If you cannot find relevant information, respond with "I don't know". Formulate long and detailed queries to get the best results. Expand abbreviations where possible.`,
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
				.max(block?.config.maxReferences ?? 10)
				.min(block?.config.minReferences ?? 1)
				.describe("The number of results to return.")
				.default(block?.config.defaultReferences ?? 5),
		}),
		execute: async ({ limit, detailedQuery }) =>
			Effect.runPromise(
				Effect.gen(function* () {
					if (!block) {
						return yield* new AiError({
							operation: "searchKnowledgeBaseTool",
							cause: new Error(
								"No database block provided for searchKnowledgeBaseTool.",
							),
						});
					}

					const result = yield* Effect.tryPromise({
						try: () =>
							client.assetPoint.list({
								filters: {
									search: detailedQuery,
									limit: limit,
									blockId: block.id,
								},
							}),

						catch: (cause) =>
							new AiError({
								operation: "searchKnowledgeBaseTool",
								cause,
							}),
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
				}),
			),
	});
