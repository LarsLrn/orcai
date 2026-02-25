import { tool } from "ai";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { runtime } from "@/lib/effect/runtime";
import { AiError } from "@/lib/effect/utils/errors";
import { client } from "@/lib/orpc/orpc";
import { assetPointSelectSchema } from "@/lib/orpc/schemas/asset-point";
import {
	baseBlockSelectSchema,
	type DatabaseBlock,
} from "@/lib/orpc/schemas/block";
import { RETRIEVAL_LIMITS } from "@/settings/constants";
import type { SearchResult } from "./types";
import {
	flattenBlockResponses,
	mergeAndSortCandidates,
	resolveSearchBlocks,
	toSearchResult,
} from "./utils";

export const searchKnowledgeBaseTool = ({
	blocks,
}: {
	blocks: DatabaseBlock[];
}) =>
	tool({
		description:
			"Search the knowledge base for relevant chunks. Use concise, entity-rich queries. Prefer at most two search calls before fetching final chunks and answering.",
		inputSchema: z.object({
			queries: z
				.array(
					z
						.string()
						.min(2)
						.describe(
							"Concise query with key entities. Avoid overly long rewritten paragraphs.",
						),
				)
				.max(5)
				.describe("Multiple query variants to increase recall."),
			limit: z.coerce
				.number()
				.int()
				.min(1)
				.max(RETRIEVAL_LIMITS.maxSnippetResultsPerCall)
				.default(6),
			blockId: baseBlockSelectSchema.shape.id
				.optional()
				.describe(
					"Optional database block id to target a specific knowledge base.",
				),
			assetIds: z
				.array(assetPointSelectSchema.shape.id)
				.optional()
				.describe("Optional list of asset IDs to scope retrieval."),
			retrievalMode: z
				.enum(["dense", "hybrid"])
				.default("hybrid")
				.describe("Hybrid is recommended for most factual searches."),
			minScore: z.number().min(0).max(1).optional(),
		}),
		execute: async ({
			queries,
			limit,
			blockId,
			assetIds,
			retrievalMode,
			minScore,
		}) =>
			runtime.runPromise(
				Effect.gen(function* () {
					if (blocks.length === 0) {
						return yield* new AiError({
							operation: "searchKnowledgeBaseTool",
							cause: new Error("No database blocks configured for this bot."),
						});
					}

					const targetBlocks = resolveSearchBlocks({ blocks, blockId });

					if (targetBlocks.length === 0) {
						return {
							result: [] as SearchResult[],
							noNewEvidence: true,
						};
					}

					const blockResponses = yield* Effect.tryPromise({
						try: () =>
							Promise.all(
								targetBlocks.map(async (block) => {
									const response = await client.assetPoint.list({
										filters: {
											queries,
											limit: Math.max(limit * 6, 24),
											blockId: block.id,
											assetIds,
											retrievalMode:
												retrievalMode ?? block.config.retrievalMode ?? "hybrid",
											minScore: minScore ?? block.config.scoreThreshold,
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
						.map((point) => toSearchResult({ point, queries }));

					return {
						result: boundedResults,
						noNewEvidence: boundedResults.length === 0,
					};
				}),
			),
	});
