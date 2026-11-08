import { groupFieldsSchema } from "@orcai/schema";
import { UsersIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { createGroupTool } from "./create-group";

export const createGroupInputSchema = groupFieldsSchema.strict();

export const createGroup = declareTool<typeof createGroupTool>()({
	kind: "create",
	group: "people",
	capabilities: [
		"manage_groups",
	],
	inputSchema: createGroupInputSchema,
	icon: UsersIcon,
	name: () => m.assistant_tool_create_group_name(),
	active: () => m.assistant_tool_create_group_active(),
	line: ({ input, output }) => {
		const name = output ? output.name : input?.name;

		return name
			? m.assistant_tool_create_group_summary({
					name: formatNames([
						name,
					]),
				})
			: m.assistant_tool_create_group_name();
	},
});
