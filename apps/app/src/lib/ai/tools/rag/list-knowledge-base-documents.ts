import { blockIdSchema, type DatabaseBlock } from "@orcai/schema";
import * as Effect from "effect/Effect";
import z from "zod/v4";
import { effectTool } from "@/lib/ai/tools/assistant/procedure-tool";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { listModelOutput } from "./outputs";
import type { KnowledgeBaseDocument } from "./types";
import {
	loadDocumentCatalog,
	rankDocumentsByQuery,
	resolveSearchBlocks,
} from "./utils";

export const listKnowledgeBaseDocumentsTool = ({
	blocks,
	context,
}: {
	blocks: DatabaseBlock[];
	context: ORPCContext;
}) =>
	effectTool({
		description:
			"List knowledge base documents and their asset IDs. Use this before page-specific retrieval or when the user mentions a document title and you need to identify the right asset.",
		inputSchema: z.object({
			query: z
				.string()
				.optional()
				.describe("Optional document-title query to narrow the list."),
			blockId: blockIdSchema
				.optional()
				.describe("Optional block ID to scope the document list."),
			limit: z.coerce
				.number()
				.int()
				.min(1)
				.max(100)
				.default(30)
				.describe("Maximum number of documents to return."),
		}),
		run: ({ query, blockId, limit }) =>
			Effect.gen(function* () {
				const targetBlocks = resolveSearchBlocks({
					blocks,
					blockId,
				});
				if (targetBlocks.length === 0) {
					return {
						documents: [] as KnowledgeBaseDocument[],
					};
				}

				const documents = yield* loadDocumentCatalog({
					blocks: targetBlocks,
					context,
				});

				const ranked = query
					? rankDocumentsByQuery({
							documents,
							query,
						})
					: documents.slice().sort((a, b) => a.title.localeCompare(b.title));

				return {
					documents: ranked.slice(0, limit),
				};
			}),
		toModelOutput: listModelOutput,
	});
