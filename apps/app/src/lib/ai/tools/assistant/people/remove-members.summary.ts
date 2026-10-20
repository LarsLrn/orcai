import { UserXIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineBatchSummary } from "../summary";

export const removeMembersSummary = defineBatchSummary<"removeMembers">({
	icon: UserXIcon,
	name: () => m.assistant_tool_remove_members_name(),
	active: () => m.assistant_tool_remove_members_active(),
	kind: "user",
	ids: (input) => input?.userIds,
	named: (output) => output.removed,
	summary: m.assistant_tool_remove_members_summary,
	verb: "remove",
});
