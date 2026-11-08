import { blockTypeSchema } from "@orcai/schema";
import { SearchIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { findBlocksTool } from "./find-blocks";
import { listPageSchema, listQuerySchema } from "./list-input";

export const findBlocksInputSchema = z.strictObject({
	type: blockTypeSchema.describe(
		"behaviour: the system prompt a bot follows. repository: assets a bot searches to answer from.",
	),
	query: listQuerySchema,
	page: listPageSchema,
});

export const findBlocks = declareTool<typeof findBlocksTool>()({
	kind: "read",
	group: "core",
	inputSchema: findBlocksInputSchema,
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

		if (input?.type === "behaviour") {
			return quoted
				? m.assistant_tool_find_blocks_summary_behaviours_query({
						count,
						query: quoted,
					})
				: m.assistant_tool_find_blocks_summary_behaviours({
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
