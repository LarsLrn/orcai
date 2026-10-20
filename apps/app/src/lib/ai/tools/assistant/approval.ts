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

export type GatedAssistantToolName = (typeof GATED_ASSISTANT_TOOLS)[number];

/**
 * The gated tools always pause; `updatePlan` pauses until the user approved a
 * plan, read as each call comes up, so an approval earlier in the turn counts.
 */
export const assistantToolApproval = ({
	isPlanApproved,
}: {
	isPlanApproved: () => boolean;
}) => ({
	...(Object.fromEntries(
		GATED_ASSISTANT_TOOLS.map((name) => [
			name,
			"user-approval",
		]),
	) as Record<GatedAssistantToolName, "user-approval">),
	updatePlan: () =>
		isPlanApproved() ? ("not-applicable" as const) : ("user-approval" as const),
});
