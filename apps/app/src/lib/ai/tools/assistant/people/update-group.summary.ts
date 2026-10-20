import { UsersIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary, formatNames } from "../summary";

export const updateGroupSummary = defineToolSummary<"updateGroup">({
	icon: UsersIcon,
	name: () => m.assistant_tool_update_group_name(),
	active: () => m.assistant_tool_update_group_active(),
	refs: (part) =>
		part.state !== "output-available" && part.input && !part.input.name
			? [
					{
						kind: "group",
						id: part.input.id,
					},
				]
			: [],
	line: (part, nameOf) => {
		const name =
			part.state === "output-available"
				? part.output.name
				: part.input &&
					(part.input.name ??
						nameOf({
							kind: "group",
							id: part.input.id,
						}));

		return name === undefined
			? m.assistant_tool_update_group_name()
			: m.assistant_tool_update_group_summary({
					name: formatNames([
						name,
					]),
				});
	},
});
