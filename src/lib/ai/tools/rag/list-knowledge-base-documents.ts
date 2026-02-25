import { tool } from "ai";
import * as Effect from "effect/Effect";
import z from "zod/v4";
import { runtime } from "@/lib/effect/runtime";
import {
	baseBlockSelectSchema,
	type DatabaseBlock,
} from "@/lib/orpc/schemas/block";
import type { KnowledgeBaseDocument } from "./types";
import {
	loadDocumentCatalog,
	rankDocumentsByQuery,
	resolveSearchBlocks,
} from "./utils";

export const listKnowledgeBaseDocumentsTool = ({
	blocks,
}: {
	blocks: DatabaseBlock[];
}) =>
	tool({
		description:
			"List available knowledge base documents (assets) and their IDs for scoped or page-specific lookup.",
		inputSchema: z.object({
			query: z
				.string()
				.optional()
				.describe("Optional title query to narrow documents."),
			blockId: baseBlockSelectSchema.shape.id
				.optional()
				.describe("Optional database block scope."),
			limit: z.coerce.number().int().min(1).max(100).default(30),
		}),
		execute: async ({ query, blockId, limit }) =>
			runtime.runPromise(
				Effect.gen(function* () {
					const targetBlocks = resolveSearchBlocks({ blocks, blockId });
					if (targetBlocks.length === 0) {
						return {
							result: [] as KnowledgeBaseDocument[],
						};
					}

					const documents = yield* loadDocumentCatalog({
						blocks: targetBlocks,
					});

					const ranked = query
						? rankDocumentsByQuery({
								documents,
								query,
							})
						: documents.slice().sort((a, b) => a.title.localeCompare(b.title));

					return {
						result: ranked.slice(0, limit),
						stats: {
							totalDocuments: documents.length,
							returnedCount: Math.min(limit, ranked.length),
						},
					};
				}),
			),
	});
