import { AiError } from "@orcai/ai";
import {
	assetIdSchema,
	blockIdSchema,
	type DatabaseBlock,
} from "@orcai/schema";
import { tool } from "ai";
import * as Effect from "effect/Effect";
import z from "zod/v4";
import { runtime } from "@/lib/effect/runtime";
import { client } from "@/lib/orpc/orpc";
import type { ChunkResult, KnowledgeBaseDocument } from "./types";
import {
	compareByPageAssetChunk,
	flattenBlockResponses,
	loadDocumentCatalog,
	mergeAndSortCandidates,
	rankDocumentsByQuery,
	resolveSearchBlocks,
	toChunkResult,
} from "./utils";

export const getKnowledgeBasePageTool = ({
	blocks,
}: {
	blocks: DatabaseBlock[];
}) =>
	tool({
		description:
			"Read full chunk text from a specific document page or nearby pages. Use this for explicit page requests after you know the document or have narrowed it down by title.",
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
			documentQuery: z
				.string()
				.optional()
				.describe(
					"Legacy alias for documentTitleQuery. Prefer documentTitleQuery for new calls.",
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
		execute: async ({
			page,
			blockId,
			assetId,
			documentTitleQuery,
			documentQuery,
			includeAdjacentPages,
			limit,
		}) =>
			runtime.runPromise(
				Effect.gen(function* () {
					const targetBlocks = resolveSearchBlocks({
						blocks,
						blockId,
					});
					if (targetBlocks.length === 0) {
						return {
							chunks: [] as ChunkResult[],
							matchedDocuments: [] as KnowledgeBaseDocument[],
							nextAction: "listKnowledgeBaseDocuments" as const,
						};
					}

					const normalizedDocumentQuery =
						documentTitleQuery?.trim() || documentQuery?.trim() || undefined;

					const documents = yield* loadDocumentCatalog({
						blocks: targetBlocks,
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
							chunks: [] as ChunkResult[],
							matchedDocuments: [] as KnowledgeBaseDocument[],
							nextAction: "listKnowledgeBaseDocuments" as const,
						};
					}

					const normalizedRequestedPage = Math.max(1, page);
					const pageFrom = Math.max(
						1,
						normalizedRequestedPage - includeAdjacentPages,
					);
					const pageTo = normalizedRequestedPage + includeAdjacentPages;
					const queryLimit = Math.max(limit * 4, 40);

					const blockResponses = yield* Effect.tryPromise({
						try: () =>
							Promise.all(
								targetBlocks.map(async (block) => {
									const response = await client.assetPoint.searchRepository({
										repositoryId: block.id,
										filters: {
											assetIds: matchedAssetIds,
											pageFrom,
											pageTo,
											limit: queryLimit,
										},
									});

									return {
										block,
										response,
									};
								}),
							),
						catch: (cause) =>
							new AiError({
								operation: "getKnowledgeBasePageTool.query",
								cause,
							}),
					});

					const points = mergeAndSortCandidates(
						flattenBlockResponses(blockResponses),
					)
						.sort(compareByPageAssetChunk)
						.slice(0, limit);

					return {
						chunks: points.map(toChunkResult),
						matchedDocuments: matchedDocuments.slice(0, 20),
						nextAction:
							points.length > 0
								? ("answerFromChunks" as const)
								: matchedDocuments.length > 1 && !assetId
									? ("listKnowledgeBaseDocuments" as const)
									: ("searchKnowledgeBase" as const),
						stats: {
							requestedPage: normalizedRequestedPage,
							pageFrom,
							pageTo,
							matchedDocumentCount: matchedDocuments.length,
							searchedDocumentCount: documentsToSearch.length,
							returnedChunkCount: Math.min(limit, points.length),
						},
					};
				}),
			),
	});
