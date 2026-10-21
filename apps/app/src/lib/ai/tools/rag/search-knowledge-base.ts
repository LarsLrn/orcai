import {
	assetIdSchema,
	blockIdSchema,
	type DatabaseBlock,
} from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { effectTool } from "@/lib/ai/tools/assistant/procedure-tool";
import { AssistantToolError } from "@/lib/ai/tools/tool-error";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { RETRIEVAL_LIMITS } from "@/settings/constants";
import type { ChunkIds } from "./chunk-ref";
import { searchModelOutput } from "./outputs";
import type { Passage } from "./types";
import {
	flattenBlockResponses,
	mergeAndSortCandidates,
	resolveSearchBlocks,
	toPassage,
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
	context,
	chunks,
}: {
	blocks: DatabaseBlock[];
	context: ORPCContext;
	chunks: ChunkIds;
}) =>
	effectTool({
		description:
			"Search the knowledge base by topic, entity, quote, or claim and return the full text of the best matching chunks. Call getKnowledgeBaseChunks only when you need the text around a chunk.",
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
		run: ({ query, queryVariants, queries, assetIds, blockId }) =>
			Effect.gen(function* () {
				const procedures = yield* Procedures;
				const normalizedQueries = normalizeQueries({
					query,
					queryVariants,
					queries,
				});
				if (normalizedQueries.length === 0) {
					return yield* Effect.fail(
						new AssistantToolError(
							"INVALID_TOOL_INPUT: Provide query or queryVariants.",
						),
					);
				}

				const targetBlocks = resolveSearchBlocks({
					blocks,
					blockId,
				});
				const limit = DEFAULT_SEARCH_RESULT_LIMIT;

				if (targetBlocks.length === 0) {
					return {
						results: [] as Passage[],
						noNewEvidence: true,
						nextAction: "refineSearchOrListDocuments" as const,
					};
				}

				const blockResponses = yield* Effect.forEach(
					targetBlocks,
					(block) =>
						procedures.assetPoint
							.searchRepository(
								{
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

				const candidates = mergeAndSortCandidates(
					flattenBlockResponses(blockResponses),
				);
				const boundedResults: Passage[] = candidates
					.slice(0, Math.min(limit, RETRIEVAL_LIMITS.maxSnippetResultsPerCall))
					.map((point) =>
						toPassage([
							point,
						]),
					);

				chunks.add(boundedResults);

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
		toModelOutput: searchModelOutput,
	});
