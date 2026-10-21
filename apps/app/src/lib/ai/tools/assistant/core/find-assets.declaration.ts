import { SearchIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { findAssetsTool } from "./find-assets";

export const findAssets = declareTool<typeof findAssetsTool>()({
	kind: "read",
	group: "core",
	icon: SearchIcon,
	name: () => m.assistant_tool_find_assets_name(),
	active: () => m.assistant_tool_find_assets_active(),
	refs: ({ input, output }) =>
		output && input?.repositoryId
			? [
					{
						kind: "repository",
						id: input.repositoryId,
					},
				]
			: [],
	line: ({ input, output }, nameOf) => {
		if (!output) {
			return m.assistant_tool_find_assets_name();
		}

		const count = output.total;
		const query = input?.query?.trim();
		const quotedQuery = query
			? m.assistant_tool_quoted_name({
					name: query,
				})
			: undefined;
		const repositoryId = input?.repositoryId;
		const repository = repositoryId
			? m.assistant_tool_quoted_name({
					name: nameOf({
						kind: "repository",
						id: repositoryId,
					}),
				})
			: undefined;

		if (repository) {
			return quotedQuery
				? m.assistant_tool_find_assets_summary_query_repository({
						count,
						query: quotedQuery,
						repository,
					})
				: m.assistant_tool_find_assets_summary_repository({
						count,
						repository,
					});
		}

		return quotedQuery
			? m.assistant_tool_find_assets_summary_query({
					count,
					query: quotedQuery,
				})
			: m.assistant_tool_find_assets_summary({
					count,
				});
	},
});
