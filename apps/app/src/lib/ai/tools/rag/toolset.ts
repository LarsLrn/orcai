import type { Repository } from "@orcai/schema";
import type { ChatSources } from "@/lib/ai/citations/chat-sources";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { getAssetPageTool } from "./get-asset-page";
import { getPassagesTool } from "./get-passages";
import { listRepositoryAssetsTool } from "./list-repository-assets";
import { searchRepositoriesTool } from "./search-repositories";

/** The repository tools of a turn, which reads passage refs from the chat's `sources`. */
export const buildRepositoryTools = ({
	blocks,
	context,
	sources,
}: {
	blocks: Repository[];
	context: ORPCContext;
	sources: ChatSources;
}) => ({
	searchRepositories: searchRepositoriesTool({
		blocks,
		context,
	}),
	listRepositoryAssets: listRepositoryAssetsTool({
		blocks,
		context,
	}),
	getAssetPage: getAssetPageTool({
		blocks,
		context,
	}),
	getPassages: getPassagesTool({
		blocks,
		context,
		sources,
	}),
});
