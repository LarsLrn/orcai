import type { AssistantToolName } from "./groups";

/** The tools that pause for the user's confirmation: destroy, revoke, widen access, change a role, send out. */
export const GATED_ASSISTANT_TOOLS = [
	"deleteBot",
	"deleteBlock",
	"deleteAsset",
	"deleteGroup",
	"revokeAccess",
	"removeGroupMembers",
	"removeMembers",
	"cancelInvitation",
	"grantAccess",
	"addGroupMembers",
	"changeMemberRole",
	"inviteMembers",
] as const satisfies AssistantToolName[];
