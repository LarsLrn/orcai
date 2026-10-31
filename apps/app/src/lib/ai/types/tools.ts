import type { InferUITool, ToolUIPart } from "ai";
import type { readDocsTool } from "@/lib/ai/tools/docs/read-docs";
import type { getAssetPageTool } from "@/lib/ai/tools/rag/get-asset-page";
import type { getPassagesTool } from "@/lib/ai/tools/rag/get-passages";
import type { listRepositoryAssetsTool } from "@/lib/ai/tools/rag/list-repository-assets";
import type { searchRepositoriesTool } from "@/lib/ai/tools/rag/search-repositories";
import type { searchWebTool } from "@/lib/ai/tools/web/search-web";

/**
 * Repository tool parts
 */
type SearchRepositoriesUITool = InferUITool<
	ReturnType<typeof searchRepositoriesTool>
>;
export type SearchRepositoriesToolPart = ToolUIPart<{
	searchRepositories: SearchRepositoriesUITool;
}>;

type GetPassagesUITool = InferUITool<ReturnType<typeof getPassagesTool>>;
export type GetPassagesToolPart = ToolUIPart<{
	getPassages: GetPassagesUITool;
}>;

type ListRepositoryAssetsUITool = InferUITool<
	ReturnType<typeof listRepositoryAssetsTool>
>;
export type ListRepositoryAssetsToolPart = ToolUIPart<{
	listRepositoryAssets: ListRepositoryAssetsUITool;
}>;

type GetAssetPageUITool = InferUITool<ReturnType<typeof getAssetPageTool>>;
export type GetAssetPageToolPart = ToolUIPart<{
	getAssetPage: GetAssetPageUITool;
}>;

/**
 * Docs Tool Part
 */

type ReadDocsUITool = InferUITool<ReturnType<typeof readDocsTool>>;
export type ReadDocsToolPart = ToolUIPart<{
	readDocs: ReadDocsUITool;
}>;

type SearchWebUITool = InferUITool<ReturnType<typeof searchWebTool>>;
export type SearchWebToolPart = ToolUIPart<{
	searchWeb: SearchWebUITool;
}>;

/** The model provider's own search; its input and output differ by provider. */
export type NativeWebSearchToolPart = ToolUIPart<{
	web_search: {
		input: unknown;
		output: unknown;
	};
}>;
