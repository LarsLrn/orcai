import { ScrollTextIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary, formatNames } from "../summary";

export const createTemplateSummary = defineToolSummary<"createTemplate">({
	icon: ScrollTextIcon,
	name: () => m.assistant_tool_create_template_name(),
	active: () => m.assistant_tool_create_template_active(),
	line: (part) => {
		const name =
			part.state === "output-available" ? part.output.name : part.input?.name;

		return name
			? m.assistant_tool_create_template_summary({
					name: formatNames([
						name,
					]),
				})
			: m.assistant_tool_create_template_name();
	},
});
