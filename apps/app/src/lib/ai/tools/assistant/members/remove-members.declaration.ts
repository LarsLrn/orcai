import { userIdSchema } from "@orcai/schema";
import { UserXIcon } from "lucide-react";
import { z } from "zod/v4";
import { batchSummary, declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { receiverIdSchema } from "./receiver-input";
import type { removeMembersTool } from "./remove-members";

export const removeMembersInputSchema = z.strictObject({
	userIds: z
		.array(userIdSchema)
		.min(1)
		.max(20)
		.describe("Ids of the members to remove, from listMembers."),
	receiverId: receiverIdSchema.describe(
		"Id of the member, from listMembers, who receives the bots, blocks and Library assets the removed members own here. Must be a Member, Manager or Admin who is not banned and not removed in this call. Leave out to give them to the user, which works only when the user is a Member, Manager or Admin here.",
	),
});

export const removeMembers = declareTool<typeof removeMembersTool>()({
	kind: "change",
	group: "people",
	capabilities: [
		"manage_members",
	],
	confirm: "remove",
	inputSchema: removeMembersInputSchema,
	icon: UserXIcon,
	name: () => m.assistant_tool_remove_members_name(),
	active: () => m.assistant_tool_remove_members_active(),
	...batchSummary<typeof removeMembersTool>({
		kind: "member",
		ids: (input) => input?.userIds,
		named: (output) => output.removed,
		summary: m.assistant_tool_remove_members_summary,
	}),
});
