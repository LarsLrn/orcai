import { BlocksIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { getBlockTool } from "./get-block";

export const getBlock = declareTool<typeof getBlockTool>()({
	kind: "read",
	group: "core",
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

			return output.type === "template"
				? m.assistant_tool_get_block_summary_template({
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
