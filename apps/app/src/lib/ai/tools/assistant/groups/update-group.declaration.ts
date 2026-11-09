import { updateGroupInputSchema as updateGroupProcedureInputSchema } from "@orcai/schema";
import { UsersIcon } from "lucide-react";
import { batchSummary, declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { updateGroupTool } from "./update-group";

export const updateGroupInputSchema = updateGroupProcedureInputSchema
	.extend({
		id: updateGroupProcedureInputSchema.shape.id.describe(
			"Id of the group to update.",
		),
		name: updateGroupProcedureInputSchema.shape.name.describe(
			"Leave out to keep the current name.",
		),
		description: updateGroupProcedureInputSchema.shape.description.describe(
			"Leave out to keep the current description; null clears it.",
		),
	})
	.strict();

export const updateGroup = declareTool<typeof updateGroupTool>()({
	kind: "change",
	group: "people",
	capabilities: [
		"manage_groups",
	],
	inputSchema: updateGroupInputSchema,
	icon: UsersIcon,
	name: () => m.assistant_tool_update_group_name(),
	active: () => m.assistant_tool_update_group_active(),
	...batchSummary<typeof updateGroupTool>({
		kind: "group",
		ids: (input) =>
			input && [
				input.id,
			],
		pendingName: (input) => input.name,
		named: (output) => [
			{
				id: output.id,
				name: output.name,
			},
		],
		summary: m.assistant_tool_update_group_summary,
	}),
});
