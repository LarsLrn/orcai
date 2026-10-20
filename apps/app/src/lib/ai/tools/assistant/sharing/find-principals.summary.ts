import { UserSearchIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary } from "../summary";
import { quoted, resourceRef } from "./summary-refs";

export const findPrincipalsSummary = defineToolSummary<"findPrincipals">({
	icon: UserSearchIcon,
	name: () => m.assistant_tool_find_principals_name(),
	active: () => m.assistant_tool_find_principals_active(),
	refs: (part) =>
		part.input
			? [
					resourceRef(part.input),
				]
			: [],
	line: (part, nameOf) => {
		if (!part.input) {
			return m.assistant_tool_find_principals_name();
		}

		const resource = quoted(nameOf(resourceRef(part.input)));

		return part.state === "output-available"
			? m.assistant_tool_find_principals_summary_found({
					count: part.output.count,
					resource,
				})
			: m.assistant_tool_find_principals_summary({
					resource,
				});
	},
});
