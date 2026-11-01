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
import { searchModelOutput } from "./outputs";
import type { Passage } from "./types";
import {
	flattenBlockResponses,
	loadReadiness,
	mergeAndSortCandidates,
	resolveSearchBlocks,
	toPassage,
	unsearchableAssets,
} from "./utils";

const normalizeQueries = ({
	query,
	queryVariants,
}: {
	query?: string;
	queryVariants?: string[];
}) =>
	Array.from(
		new Set(
			[
				query,
				...(queryVariants ?? []),
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

export const searchRepositoriesTool = ({
	blocks,
	context,
}: {
	blocks: DatabaseBlock[];
	context: ORPCContext;
}) =>
	effectTool({
		description:
			"Search the repositories by topic, name, quote or claim, and return the full text of the best matching passages, each with the ref you cite it by. Use it first for any question the repositories may answer; for a page the user names, use getAssetPage, and for the list of assets, listRepositoryAssets. Only ready assets are searchable: the result names repositories with assets still being prepared or that failed, and the answer may be in those, so tell the user.",
		inputSchema: z.strictObject({
			query: z
				.string()
				.min(2)
				.optional()
				.describe(
					"What to search for, as one focused phrase or question rather than a rewritten paragraph.",
				),
			queryVariants: z
				.array(
					z
						.string()
						.min(2)
						.describe("Another short wording of the same search."),
				)
				.max(4)
				.optional()
				.describe(
					"Other wordings of the same search, only for synonyms or names the query may miss.",
				),
			assetIds: z
				.array(assetIdSchema)
				.max(20)
				.optional()
				.describe(
					"Ids of the assets to search, from listRepositoryAssets. Leave it out to search every asset.",
				),
			blockId: blockIdSchema
				.optional()
				.describe(
					"Id of the one repository to search. Leave it out to search all of them.",
				),
		}),
		run: ({ query, queryVariants, assetIds, blockId }) =>
			Effect.gen(function* () {
				const procedures = yield* Procedures;
				const normalizedQueries = normalizeQueries({
					query,
					queryVariants,
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
					};
				}

				const [blockResponses, repositories] = yield* Effect.all(
					[
						Effect.forEach(
							targetBlocks,
							(block) =>
								procedures.assetPoint
									.searchRepository(
										{
											repositoryId: block.id,
											filters: {
												queries: normalizedQueries,
												limit,
												recallLimit: Math.max(limit * 6, 24),
												assetIds,
												retrievalMode: block.config.retrievalMode ?? "hybrid",
												minScore: block.config.scoreThreshold,
												candidateLimit:
													block.config.candidateLimit ??
													Math.max(limit * 8, 32),
												maxPerAsset: block.config.maxPerAsset,
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
						),
						// Only adds notSearchable; a failure must not lose the results.
						loadReadiness({
							blocks: targetBlocks,
							context,
						}).pipe(Effect.orElseSucceed(() => [])),
					],
					{
						concurrency: "unbounded",
					},
				);
				const notSearchable = unsearchableAssets(repositories);

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

				return {
					results: boundedResults,
					...(notSearchable.length > 0
						? {
								notSearchable,
							}
						: {}),
				};
			}),
		toModelOutput: searchModelOutput,
	});
