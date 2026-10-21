import { SearchIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { findBlocksTool } from "./find-blocks";

export const findBlocks = declareTool<typeof findBlocksTool>()({
	kind: "read",
	group: "core",
	icon: SearchIcon,
	name: () => m.assistant_tool_find_blocks_name(),
	active: () => m.assistant_tool_find_blocks_active(),
	line: ({ input, output }) => {
		if (!output) {
			return m.assistant_tool_find_blocks_name();
		}

		const count = output.total;
		const query = input?.query?.trim();
		const quoted = query
			? m.assistant_tool_quoted_name({
					name: query,
				})
			: undefined;

		if (input?.type === "template") {
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
