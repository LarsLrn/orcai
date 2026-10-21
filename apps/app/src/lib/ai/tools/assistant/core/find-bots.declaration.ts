import { SearchIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { findBotsTool } from "./find-bots";

export const findBots = declareTool<typeof findBotsTool>()({
	kind: "read",
	group: "core",
	icon: SearchIcon,
	name: () => m.assistant_tool_find_bots_name(),
	active: () => m.assistant_tool_find_bots_active(),
	line: ({ input, output }) => {
		if (!output) {
			return m.assistant_tool_find_bots_name();
		}

		const query = input?.query?.trim();

		return query
			? m.assistant_tool_find_bots_summary_query({
					count: output.total,
					query: m.assistant_tool_quoted_name({
						name: query,
					}),
				})
			: m.assistant_tool_find_bots_summary({
					count: output.total,
				});
	},
});
