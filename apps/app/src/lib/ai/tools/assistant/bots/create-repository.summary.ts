import { LibraryIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary, formatNames } from "../summary";

export const createRepositorySummary = defineToolSummary<"createRepository">({
	icon: LibraryIcon,
	name: () => m.assistant_tool_create_repository_name(),
	active: () => m.assistant_tool_create_repository_active(),
	line: (part) => {
		const name =
			part.state === "output-available" ? part.output.name : part.input?.name;

		return name
			? m.assistant_tool_create_repository_summary({
					name: formatNames([
						name,
					]),
				})
			: m.assistant_tool_create_repository_name();
	},
});
