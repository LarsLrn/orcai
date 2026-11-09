import type { Repository } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { getAssetPageInputSchema } from "./get-asset-page.declaration";
import { pageModelOutput } from "./outputs";
import { neighbouringRuns } from "./passages";
import type { Passage, RepositoryAsset } from "./types";
import {
	compareByPageAssetPassage,
	flattenBlockResponses,
	loadAssetCatalog,
	rankAssetsByQuery,
	resolveSearchBlocks,
	toPassage,
} from "./utils";

export const getAssetPageTool = ({
	blocks,
	context,
}: {
	blocks: Repository[];
	context: ORPCContext;
}) =>
	effectTool({
		description:
			"Read the passages on a page of an asset, and optionally the pages around it. Use it when the user asks about a page. Pass assetId when you know it, or else assetTitleQuery with words from the title; with neither, it reads the page in up to five assets. When the page has no text, the result lists the matching assets instead, so you can pick another.",
		inputSchema: getAssetPageInputSchema,
		run: ({
			page,
			blockId,
			assetId,
			assetTitleQuery,
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

				const normalizedTitleQuery = assetTitleQuery?.trim() || undefined;

				const assets = yield* loadAssetCatalog({
					blocks: targetBlocks,
					context,
				});

				let matchedAssets: RepositoryAsset[] = assets;
				if (assetId) {
					matchedAssets = matchedAssets.filter(
						(asset) => asset.assetId === assetId,
					);
				}

				if (normalizedTitleQuery) {
					matchedAssets = rankAssetsByQuery({
						assets: matchedAssets,
						query: normalizedTitleQuery,
					});
				}

				const assetsToSearch = matchedAssets.slice(0, 5);
				const matchedAssetIds = Array.from(
					new Set(assetsToSearch.map((asset) => asset.assetId)),
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

				const points = flattenBlockResponses(blockResponses)
					.sort(compareByPageAssetPassage)
					.slice(0, limit);

				const passages = neighbouringRuns(points).map((run) => toPassage(run));

				// Without text on the pages, the assets help pick another one.
				return {
					passages,
					...(passages.length === 0 && {
						matchedAssets: matchedAssets.slice(0, 20),
					}),
				};
			}),
		toModelOutput: pageModelOutput,
	});
