import { BlocksIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary } from "../summary";

export const getBlockSummary = defineToolSummary<"getBlock">({
	icon: BlocksIcon,
	name: () => m.assistant_tool_get_block_name(),
	active: () => m.assistant_tool_get_block_active(),
	refs: (part) =>
		part.state === "output-available" || !part.input
			? []
			: [
					{
						kind: "block",
						id: part.input.id,
					},
				],
	line: (part, nameOf) => {
		if (part.state === "output-available") {
			const name = m.assistant_tool_quoted_name({
				name: part.output.name,
			});

			return part.output.type === "template"
				? m.assistant_tool_get_block_summary_template({
						name,
					})
				: m.assistant_tool_get_block_summary_repository({
						name,
					});
		}

		return part.input
			? m.assistant_tool_get_block_summary({
					name: m.assistant_tool_quoted_name({
						name: nameOf({
							kind: "block",
							id: part.input.id,
						}),
					}),
				})
			: m.assistant_tool_get_block_name();
	},
});
