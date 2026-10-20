import { SearchIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary } from "../summary";

export const findBotsSummary = defineToolSummary<"findBots">({
	icon: SearchIcon,
	name: () => m.assistant_tool_find_bots_name(),
	active: () => m.assistant_tool_find_bots_active(),
	line: (part) => {
		if (part.state !== "output-available") {
			return m.assistant_tool_find_bots_name();
		}

		const count = part.output.total;
		const query = part.input?.query?.trim();

		return query
			? m.assistant_tool_find_bots_summary_query({
					count,
					query: m.assistant_tool_quoted_name({
						name: query,
					}),
				})
			: m.assistant_tool_find_bots_summary({
					count,
				});
	},
});
