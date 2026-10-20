import { ShieldCheckIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary } from "../summary";
import { quoted, resourceRef } from "./summary-refs";

export const listAccessSummary = defineToolSummary<"listAccess">({
	icon: ShieldCheckIcon,
	name: () => m.assistant_tool_list_access_name(),
	active: () => m.assistant_tool_list_access_active(),
	refs: (part) =>
		part.input
			? [
					resourceRef(part.input),
				]
			: [],
	line: (part, nameOf) => {
		if (!part.input) {
			return m.assistant_tool_list_access_name();
		}

		const resource = quoted(nameOf(resourceRef(part.input)));

		return part.state === "output-available"
			? m.assistant_tool_list_access_summary_found({
					count: part.output.total,
					resource,
				})
			: m.assistant_tool_list_access_summary({
					resource,
				});
	},
});
