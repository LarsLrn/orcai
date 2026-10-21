import { UserXIcon } from "lucide-react";
import { batchSummary, declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { removeMembersTool } from "./remove-members";

export const removeMembers = declareTool<typeof removeMembersTool>()({
	kind: "change",
	group: "people",
	capabilities: [
		"manage_members",
	],
	confirm: "remove",
	icon: UserXIcon,
	name: () => m.assistant_tool_remove_members_name(),
	active: () => m.assistant_tool_remove_members_active(),
	...batchSummary<typeof removeMembersTool>({
		kind: "user",
		ids: (input) => input?.userIds,
		named: (output) => output.removed,
		summary: m.assistant_tool_remove_members_summary,
	}),
});
