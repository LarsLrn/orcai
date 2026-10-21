import {
	assetIdSchema,
	blockIdSchema,
	type DatabaseBlock,
} from "@orcai/schema";
import * as Effect from "effect/Effect";
import z from "zod/v4";
import { effectTool } from "@/lib/ai/tools/assistant/procedure-tool";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import type { ChunkIds } from "./chunk-ref";
import { pageModelOutput } from "./outputs";
import { neighbouringRuns } from "./passages";
import type { KnowledgeBaseDocument, Passage } from "./types";
import {
	compareByPageAssetChunk,
	flattenBlockResponses,
	loadDocumentCatalog,
	mergeAndSortCandidates,
	rankDocumentsByQuery,
	resolveSearchBlocks,
	toPassage,
} from "./utils";

export const getKnowledgeBasePageTool = ({
	blocks,
	context,
	chunks,
}: {
	blocks: DatabaseBlock[];
	context: ORPCContext;
	chunks: ChunkIds;
}) =>
	effectTool({
		description:
			"Read the text of a specific document page or nearby pages. Use this for explicit page requests after you know the document or have narrowed it down by title.",
		inputSchema: z.object({
			page: z.coerce
				.number()
				.int()
				.min(1)
				.describe("1-based page number to retrieve."),
			blockId: blockIdSchema.optional(),
			assetId: assetIdSchema
				.optional()
				.describe("Optional specific document asset ID."),
			documentTitleQuery: z
				.string()
				.optional()
				.describe(
					"Optional document-title query when assetId is not known yet.",
				),
			includeAdjacentPages: z.coerce
				.number()
				.int()
				.min(0)
				.max(2)
				.default(0)
				.describe("Include nearby pages around the requested page."),
			limit: z.coerce
				.number()
				.int()
				.min(1)
				.max(30)
				.default(12)
				.describe("Maximum number of returned chunks."),
		}),
		run: ({
			page,
			blockId,
			assetId,
			documentTitleQuery,
			includeAdjacentPages,
			limit,
		}) =>
			Effect.gen(function* () {
				const procedures = yield* Procedures;
				const targetBlocks = resolveSearchBlocks({
					blocks,
					blockId,
				});
				if (targetBlocks.length === 0) {
					return {
						passages: [] as Passage[],
					};
				}

				const normalizedDocumentQuery = documentTitleQuery?.trim() || undefined;

				const documents = yield* loadDocumentCatalog({
					blocks: targetBlocks,
					context,
				});

				let matchedDocuments: KnowledgeBaseDocument[] = documents;
				if (assetId) {
					matchedDocuments = matchedDocuments.filter(
						(document) => document.assetId === assetId,
					);
				}

				if (normalizedDocumentQuery) {
					matchedDocuments = rankDocumentsByQuery({
						documents: matchedDocuments,
						query: normalizedDocumentQuery,
					});
				}

				const documentsToSearch = matchedDocuments.slice(0, 5);
				const matchedAssetIds = Array.from(
					new Set(documentsToSearch.map((document) => document.assetId)),
				);

				if (matchedAssetIds.length === 0) {
					return {
						passages: [] as Passage[],
					};
				}

				const normalizedRequestedPage = Math.max(1, page);
				const pageFrom = Math.max(
					1,
					normalizedRequestedPage - includeAdjacentPages,
				);
				const pageTo = normalizedRequestedPage + includeAdjacentPages;
				const queryLimit = Math.max(limit * 4, 40);

				const blockResponses = yield* Effect.forEach(
					targetBlocks,
					(block) =>
						procedures.assetPoint
							.searchRepository(
								{
									repositoryId: block.id,
									filters: {
										assetIds: matchedAssetIds,
										pageFrom,
										pageTo,
										limit: queryLimit,
									},
								},
								{
									context,
								},
							)
							.pipe(
								Effect.map((response) => ({
									block,
									response,
								})),
							),
					{
						concurrency: "unbounded",
					},
				);

				const points = mergeAndSortCandidates(
					flattenBlockResponses(blockResponses),
				)
					.sort(compareByPageAssetChunk)
					.slice(0, limit);

				const passages = neighbouringRuns(points).map((run) => toPassage(run));
				chunks.add(passages);

				// Without text on the pages, the documents help pick another one.
				return {
					passages,
					...(passages.length === 0 && {
						matchedDocuments: matchedDocuments.slice(0, 20),
					}),
				};
			}),
		toModelOutput: pageModelOutput,
	});
