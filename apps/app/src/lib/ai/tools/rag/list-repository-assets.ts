import type { Repository } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { listRepositoryAssetsInputSchema } from "./list-repository-assets.declaration";
import { listModelOutput } from "./outputs";
import type { RepositoryAsset } from "./types";
import {
	loadAssetCatalog,
	rankAssetsByQuery,
	resolveSearchBlocks,
} from "./utils";

export const listRepositoryAssetsTool = ({
	blocks,
	context,
}: {
	blocks: Repository[];
	context: ORPCContext;
}) =>
	effectTool({
		description:
			"List the assets in the repositories with their ids, titles, citation labels, descriptions and preparation states. Use it when the user asks what you can search, or names an asset whose id you need. Only ready assets are searchable: one that is queued, processing or indexing is still being prepared, and a failed one names its failure. Tell the user about such an asset rather than treating it as empty.",
		inputSchema: listRepositoryAssetsInputSchema,
		run: ({ query, blockId, limit }) =>
			Effect.gen(function* () {
				const targetBlocks = resolveSearchBlocks({
					blocks,
					blockId,
				});
				if (targetBlocks.length === 0) {
					return {
						assets: [] as RepositoryAsset[],
					};
				}

				const assets = yield* loadAssetCatalog({
					blocks: targetBlocks,
					context,
				});

				const ranked = query
					? rankAssetsByQuery({
							assets,
							query,
						})
					: assets.slice().sort((a, b) => a.title.localeCompare(b.title));

				return {
					assets: ranked.slice(0, limit),
				};
			}),
		toModelOutput: listModelOutput,
	});
