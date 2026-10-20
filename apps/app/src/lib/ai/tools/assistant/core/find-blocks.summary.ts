import { SearchIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary } from "../summary";

export const findBlocksSummary = defineToolSummary<"findBlocks">({
	icon: SearchIcon,
	name: () => m.assistant_tool_find_blocks_name(),
	active: () => m.assistant_tool_find_blocks_active(),
	line: (part) => {
		if (part.state !== "output-available") {
			return m.assistant_tool_find_blocks_name();
		}

		const count = part.output.total;
		const query = part.input?.query?.trim();
		const quoted = query
			? m.assistant_tool_quoted_name({
					name: query,
				})
			: undefined;

		if (part.input?.type === "template") {
			return quoted
				? m.assistant_tool_find_blocks_summary_templates_query({
						count,
						query: quoted,
					})
				: m.assistant_tool_find_blocks_summary_templates({
						count,
					});
		}

		return quoted
			? m.assistant_tool_find_blocks_summary_repositories_query({
					count,
					query: quoted,
				})
			: m.assistant_tool_find_blocks_summary_repositories({
					count,
				});
	},
});
