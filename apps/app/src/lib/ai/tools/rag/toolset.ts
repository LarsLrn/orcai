import type { DatabaseBlock } from "@orcai/schema";
import type { UIMessage } from "ai";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { chunkIds } from "./chunk-ref";
import { getAssetPageTool } from "./get-asset-page";
import { getPassagesTool } from "./get-passages";
import { listRepositoryAssetsTool } from "./list-repository-assets";
import { passagesOfParts } from "./outputs";
import { searchRepositoriesTool } from "./search-repositories";

/** The repository tools of a turn, which reads chunk refs from `history` on. */
export const buildRepositoryTools = ({
	blocks,
	context,
	history,
}: {
	blocks: DatabaseBlock[];
	context: ORPCContext;
	history: readonly UIMessage[];
}) => {
	const deps = {
		blocks,
		context,
		chunks: chunkIds(history.flatMap(({ parts }) => passagesOfParts(parts))),
	};

	return {
		searchRepositories: searchRepositoriesTool(deps),
		listRepositoryAssets: listRepositoryAssetsTool(deps),
		getAssetPage: getAssetPageTool(deps),
		getPassages: getPassagesTool(deps),
	};
};
