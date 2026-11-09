import { UserRoundIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { listPageSchema } from "../list-input";
import type { listMembersTool } from "./list-members";

export const listMembersInputSchema = z.strictObject({
	query: z
		.string()
		.trim()
		.max(100)
		.optional()
		.describe("Part of the name or email to search for, case-insensitive."),
	page: listPageSchema,
});

export const listMembers = declareTool<typeof listMembersTool>()({
	kind: "read",
	group: "core",
	capabilities: [
		"manage_members",
	],
	inputSchema: listMembersInputSchema,
	icon: UserRoundIcon,
	name: () => m.assistant_tool_list_members_name(),
	active: () => m.assistant_tool_list_members_active(),
	line: ({ input, output }) => {
		if (!output) {
			return m.assistant_tool_list_members_name();
		}

		const query = input?.query?.trim();

		return query
			? m.assistant_tool_list_members_summary_query({
					count: output.total,
					query: m.assistant_tool_quoted_name({
						name: query,
					}),
				})
			: m.assistant_tool_list_members_summary({
					count: output.total,
				});
	},
});
