import { AiError } from "@orcai/ai";
import {
	assetIdSchema,
	blockIdSchema,
	type DatabaseBlock,
} from "@orcai/schema";
import { tool } from "ai";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { runtime } from "@/lib/effect/runtime";
import { client } from "@/lib/orpc/orpc";
import { RETRIEVAL_LIMITS } from "@/settings/constants";
import type { SearchResult } from "./types";
import {
	flattenBlockResponses,
	mergeAndSortCandidates,
	resolveSearchBlocks,
	toSearchResult,
} from "./utils";

const normalizeQueries = ({
	query,
	queryVariants,
	queries,
}: {
	query?: string;
	queryVariants?: string[];
	queries?: string[];
}) =>
	Array.from(
		new Set(
			[
				query,
				...(queryVariants ?? []),
				...(queries ?? []),
			]
				.map((value) => value?.trim())
				.filter((value): value is string =>
					Boolean(value && value.length >= 2),
				),
		),
	).slice(0, 5);

const DEFAULT_SEARCH_RESULT_LIMIT = Math.min(
	6,
	RETRIEVAL_LIMITS.maxSnippetResultsPerCall,
);

export const searchKnowledgeBaseTool = ({
	blocks,
}: {
	blocks: DatabaseBlock[];
}) =>
	tool({
		description:
			"Search the knowledge base by topic, entity, quote, or claim and return short relevance snippets. Use this to shortlist evidence, then call getKnowledgeBaseChunks to read the full chunk text before giving a factual answer.",
		inputSchema: z.object({
			query: z
				.string()
				.min(2)
				.optional()
				.describe(
					"Primary search query. Prefer one focused query over a long rewritten paragraph.",
				),
			queryVariants: z
				.array(
					z
						.string()
						.min(2)
						.describe("Short alternate wording of the same search intent."),
				)
				.max(4)
				.optional()
				.describe(
					"Optional short alternate phrasings. Use only when one query may miss synonyms or aliases.",
				),
			queries: z
				.array(
					z
						.string()
						.min(2)
						.describe(
							"Legacy alias for query variants. Prefer query and queryVariants for new calls.",
						),
				)
				.max(5)
				.optional(),
			assetIds: z
				.array(assetIdSchema)
				.max(20)
				.optional()
				.describe(
					"Optional document asset IDs to scope retrieval after using listKnowledgeBaseDocuments.",
				),
			blockId: blockIdSchema
				.optional()
				.describe("Optional block ID to search only one knowledge base block."),
		}),
		execute: async ({ query, queryVariants, queries, assetIds, blockId }) =>
			runtime.runPromise(
				Effect.gen(function* () {
					if (blocks.length === 0) {
						return yield* new AiError({
							operation: "searchKnowledgeBaseTool",
							cause: new Error("No database blocks configured for this bot."),
						});
					}

					const normalizedQueries = normalizeQueries({
						query,
						queryVariants,
						queries,
					});
					if (normalizedQueries.length === 0) {
						return yield* new AiError({
							operation: "searchKnowledgeBaseTool",
							cause: new Error("Provide query or queryVariants."),
						});
					}

					const targetBlocks = resolveSearchBlocks({
						blocks,
						blockId,
					});
					const limit = DEFAULT_SEARCH_RESULT_LIMIT;

					if (targetBlocks.length === 0) {
						return {
							results: [] as SearchResult[],
							noNewEvidence: true,
							nextAction: "refineSearchOrListDocuments" as const,
						};
					}

					const blockResponses = yield* Effect.tryPromise({
						try: () =>
							Promise.all(
								targetBlocks.map(async (block) => {
									const response = await client.assetPoint.searchRepository({
										repositoryId: block.id,
										filters: {
											queries: normalizedQueries,
											limit: Math.max(limit * 6, 24),
											assetIds,
											retrievalMode: block.config.retrievalMode ?? "hybrid",
											minScore: block.config.scoreThreshold,
											candidateLimit:
												block.config.candidateLimit ?? Math.max(limit * 8, 32),
											maxPerAsset: block.config.maxPerAsset ?? 2,
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
								operation: "searchKnowledgeBaseTool.search",
								cause,
							}),
					});

					const candidates = mergeAndSortCandidates(
						flattenBlockResponses(blockResponses),
					);
					const boundedResults: SearchResult[] = candidates
						.slice(
							0,
							Math.min(limit, RETRIEVAL_LIMITS.maxSnippetResultsPerCall),
						)
						.map((point) =>
							toSearchResult({
								point,
								queries: normalizedQueries,
							}),
						);

					return {
						results: boundedResults,
						noNewEvidence: boundedResults.length === 0,
						nextAction:
							boundedResults.length > 0
								? ("getKnowledgeBaseChunks" as const)
								: ("refineSearchOrListDocuments" as const),
						stats: {
							queryCount: normalizedQueries.length,
							returnedCount: boundedResults.length,
							searchedBlockCount: targetBlocks.length,
							assetScopeCount: assetIds?.length ?? 0,
						},
					};
				}),
			),
	});
