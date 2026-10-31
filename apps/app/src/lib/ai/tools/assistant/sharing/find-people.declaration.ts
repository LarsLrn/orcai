import { UserSearchIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { findPeopleTool } from "./find-people";
import { quoted, targetRef } from "./summary-refs";

export const findPeople = declareTool<typeof findPeopleTool>()({
	kind: "read",
	group: "sharing",
	capabilities: [
		"create_bot",
	],
	icon: UserSearchIcon,
	name: () => m.assistant_tool_find_people_name(),
	active: () => m.assistant_tool_find_people_active(),
	refs: ({ input }) =>
		input
			? [
					targetRef(input),
				]
			: [],
	line: ({ input, output }, nameOf) => {
		if (!input) {
			return m.assistant_tool_find_people_name();
		}

		const resource = quoted(nameOf(targetRef(input)));

		return output
			? m.assistant_tool_find_people_summary_found({
					count: output.count,
					resource,
				})
			: m.assistant_tool_find_people_summary({
					resource,
				});
	},
});
