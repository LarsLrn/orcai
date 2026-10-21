import { ScrollTextIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { updateTemplateTool } from "./update-template";

export const updateTemplate = declareTool<typeof updateTemplateTool>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	icon: ScrollTextIcon,
	name: () => m.assistant_tool_update_template_name(),
	active: () => m.assistant_tool_update_template_active(),
	refs: ({ input, output }) =>
		!output && input && !input.name
			? [
					{
						kind: "block",
						id: input.id,
					},
				]
			: [],
	line: ({ input, output }, nameOf) => {
		const name = output
			? output.name
			: input &&
				(input.name ??
					nameOf({
						kind: "block",
						id: input.id,
					}));

		return name === undefined
			? m.assistant_tool_update_template_name()
			: m.assistant_tool_update_template_summary({
					name: formatNames([
						name,
					]),
				});
	},
});
