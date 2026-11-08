import { blockIdSchema } from "@orcai/schema";
import { BlocksIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { getBlockTool } from "./get-block";

export const getBlockInputSchema = z.strictObject({
	id: blockIdSchema.describe(
		"Id of the behaviour or repository, from findBlocks or getBot.",
	),
});

export const getBlock = declareTool<typeof getBlockTool>()({
	kind: "read",
	group: "core",
	inputSchema: getBlockInputSchema,
	icon: BlocksIcon,
	name: () => m.assistant_tool_get_block_name(),
	active: () => m.assistant_tool_get_block_active(),
	refs: ({ input, output }) =>
		output || !input
			? []
			: [
					{
						kind: "block",
						id: input.id,
					},
				],
	line: ({ input, output }, nameOf) => {
		if (output) {
			const name = m.assistant_tool_quoted_name({
				name: output.name,
			});

			return output.type === "behaviour"
				? m.assistant_tool_get_block_summary_behaviour({
						name,
					})
				: m.assistant_tool_get_block_summary_repository({
						name,
					});
		}

		return input
			? m.assistant_tool_get_block_summary({
					name: m.assistant_tool_quoted_name({
						name: nameOf({
							kind: "block",
							id: input.id,
						}),
					}),
				})
			: m.assistant_tool_get_block_name();
	},
});
