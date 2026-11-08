import { resourceListPrincipalsInputSchema } from "@orcai/schema";
import { UserSearchIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { listPageSchema } from "../core/list-input";
import type { findPeopleTool } from "./find-people";
import { targetShape } from "./resource-target-input";
import { quoted, targetRef } from "./summary-refs";

const principalFilters = resourceListPrincipalsInputSchema.options[0].shape;

export const findPeopleInputSchema = z.strictObject({
	...targetShape,
	granteeType: principalFilters.principalType.describe(
		"Only users or only groups; leave out for both.",
	),
	query: principalFilters.query.describe(
		"Part of the name (or a user's email) to search for, case-insensitive.",
	),
	excludeGranted: principalFilters.excludeGranted.describe(
		"Leave out users and groups that already hold a direct grant.",
	),
	page: listPageSchema,
});

export const findPeople = declareTool<typeof findPeopleTool>()({
	kind: "read",
	group: "sharing",
	capabilities: [
		"create_bot",
	],
	inputSchema: findPeopleInputSchema,
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
					count: output.total,
					resource,
				})
			: m.assistant_tool_find_people_summary({
					resource,
				});
	},
});
