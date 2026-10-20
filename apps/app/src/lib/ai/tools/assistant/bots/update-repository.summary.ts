import { LibraryIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary, formatNames } from "../summary";

export const updateRepositorySummary = defineToolSummary<"updateRepository">({
	icon: LibraryIcon,
	name: () => m.assistant_tool_update_repository_name(),
	active: () => m.assistant_tool_update_repository_active(),
	refs: (part) =>
		part.state !== "output-available" && part.input && !part.input.name
			? [
					{
						kind: "block",
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
							kind: "block",
							id: part.input.id,
						}));

		return name === undefined
			? m.assistant_tool_update_repository_name()
			: m.assistant_tool_update_repository_summary({
					name: formatNames([
						name,
					]),
				});
	},
});
