import { type Repository, SEARCH_QUERIES_MAX } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { AssistantToolError } from "@/lib/ai/tools/tool-error";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { RETRIEVAL_LIMITS } from "@/settings/constants";
import { searchModelOutput } from "./outputs";
import { searchRepositoriesInputSchema } from "./search-repositories.declaration";
import type { Passage } from "./types";
import {
	loadReadiness,
	mergeByRank,
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
	).slice(0, SEARCH_QUERIES_MAX);

const DEFAULT_SEARCH_RESULT_LIMIT = Math.min(
	6,
	RETRIEVAL_LIMITS.maxSnippetResultsPerCall,
);

/** How the tool ranks a repository's points for `limit` passages. */
export const repositorySearchPolicy = (
	config: Pick<
		Repository["config"],
		"retrievalMode" | "candidateLimit" | "maxPerAsset"
	>,
	limit: number,
) => ({
	limit,
	retrievalMode: config.retrievalMode ?? "hybrid",
	candidateLimit: config.candidateLimit ?? Math.max(limit * 8, 32),
	maxPerAsset: config.maxPerAsset,
});

export const searchRepositoriesTool = ({
	blocks,
	context,
}: {
	blocks: Repository[];
	context: ORPCContext;
}) =>
	effectTool({
		description:
			"Search the repositories by topic, name, quote or claim, and return the full text of the best matching passages, each with the ref you cite it by. Use it first for any question the repositories may answer; for a page the user names, use getAssetPage, and for the list of assets, listRepositoryAssets. Only ready assets are searchable: the result names repositories with assets still being prepared or that failed, and the answer may be in those, so tell the user.",
		inputSchema: searchRepositoriesInputSchema,
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
						// One request, so every repository is searched on one generation and the queries are embedded once.
						procedures.assetPoint
							.searchRepositories(
								{
									searches: targetBlocks.map((block) => ({
										repositoryId: block.id,
										filters: {
											queries: normalizedQueries,
											assetIds,
											...repositorySearchPolicy(block.config, limit),
										},
									})),
								},
								{
									context,
								},
							)
							.pipe(
								Effect.map(({ results }) =>
									targetBlocks.map((block, index) => ({
										block,
										response: results[index],
									})),
								),
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

				const boundedResults: Passage[] = mergeByRank(blockResponses)
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
