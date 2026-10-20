import { UsersIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary, formatNames } from "../summary";

export const createGroupSummary = defineToolSummary<"createGroup">({
	icon: UsersIcon,
	name: () => m.assistant_tool_create_group_name(),
	active: () => m.assistant_tool_create_group_active(),
	line: (part) => {
		const name =
			part.state === "output-available" ? part.output.name : part.input?.name;

		return name
			? m.assistant_tool_create_group_summary({
					name: formatNames([
						name,
					]),
				})
			: m.assistant_tool_create_group_name();
	},
});
