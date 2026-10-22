import { NATIVE_WEB_SEARCH_TOOL_NAME, nativeWebSearchTool } from "@orcai/ai";
import type { ModelProviderKind } from "@orcai/core";
import { type Tool, type ToolSet, tool } from "ai";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { AssistantToolError } from "@/lib/ai/tools/tool-error";
import type { MeteredWebSearch } from "./metered-web-search";
import { searchWebTool } from "./search-web";

/** How a turn searches the web, read once before it starts. */
export type TurnWebSearch =
	| {
			kind: "native";
			modelKind: ModelProviderKind;
	  }
	| {
			kind: "provider";
			search: MeteredWebSearch;
	  }
	| {
			kind: "none";
	  };

export const NO_WEB_SEARCH: TurnWebSearch = {
	kind: "none",
};

/** The search tool a turn offers within `allowedDomains`: the model's own or our search provider's. */
export const buildWebSearchTools = ({
	webSearch,
	allowedDomains,
}: {
	webSearch: TurnWebSearch;
	allowedDomains: readonly string[];
}): ToolSet => {
	switch (webSearch.kind) {
		case "none":
			return {};
		case "provider":
			return {
				searchWeb: searchWebTool({
					search: webSearch.search,
					allowedDomains,
				}),
			};
		case "native": {
			const tool = nativeWebSearchTool(webSearch.modelKind, allowedDomains);
			return tool
				? {
						[NATIVE_WEB_SEARCH_TOOL_NAME]: tool,
					}
				: {};
		}
	}
};

/** The search tools of the typed tool set, which only checks stored calls; every provider's native call passes. */
export const storedWebSearchTools = () => ({
	searchWeb: searchWebTool({
		search: () =>
			Effect.fail(
				new AssistantToolError("TOOL_NOT_AVAILABLE: Web search is off."),
			),
		allowedDomains: [],
	}),
	[NATIVE_WEB_SEARCH_TOOL_NAME]: tool({
		inputSchema: z.looseObject({}),
	}) as Tool,
});
