import { SearchIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { findBotsTool } from "./find-bots";
import { listPageSchema, listQuerySchema } from "./list-input";

export const findBotsInputSchema = z.strictObject({
	query: listQuerySchema,
	page: listPageSchema,
});

export const findBots = declareTool<typeof findBotsTool>()({
	kind: "read",
	group: "core",
	inputSchema: findBotsInputSchema,
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
