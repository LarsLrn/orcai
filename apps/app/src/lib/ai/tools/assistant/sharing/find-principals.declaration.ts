import { UserSearchIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { findPrincipalsTool } from "./find-principals";
import { quoted, resourceRef } from "./summary-refs";

export const findPrincipals = declareTool<typeof findPrincipalsTool>()({
	kind: "read",
	group: "sharing",
	capabilities: [
		"create_bot",
	],
	icon: UserSearchIcon,
	name: () => m.assistant_tool_find_principals_name(),
	active: () => m.assistant_tool_find_principals_active(),
	refs: ({ input }) =>
		input
			? [
					resourceRef(input),
				]
			: [],
	line: ({ input, output }, nameOf) => {
		if (!input) {
			return m.assistant_tool_find_principals_name();
		}

		const resource = quoted(nameOf(resourceRef(input)));

		return output
			? m.assistant_tool_find_principals_summary_found({
					count: output.count,
					resource,
				})
			: m.assistant_tool_find_principals_summary({
					resource,
				});
	},
});
