import { SearchIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary } from "../summary";

export const findAssetsSummary = defineToolSummary<"findAssets">({
	icon: SearchIcon,
	name: () => m.assistant_tool_find_assets_name(),
	active: () => m.assistant_tool_find_assets_active(),
	refs: (part) =>
		part.state === "output-available" && part.input?.repositoryId
			? [
					{
						kind: "block",
						id: part.input.repositoryId,
					},
				]
			: [],
	line: (part, nameOf) => {
		if (part.state !== "output-available") {
			return m.assistant_tool_find_assets_name();
		}

		const count = part.output.total;
		const query = part.input?.query?.trim();
		const quotedQuery = query
			? m.assistant_tool_quoted_name({
					name: query,
				})
			: undefined;
		const repositoryId = part.input?.repositoryId;
		const repository = repositoryId
			? m.assistant_tool_quoted_name({
					name: nameOf({
						kind: "block",
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
