import type { DisplayToolName } from "@/components/chat/gen-ui/catalog";
import type { ToolPart } from "@/components/chat/message/classify-turn";
import { createBotSummary } from "@/lib/ai/tools/assistant/bots/create-bot.summary";
import { createRepositorySummary } from "@/lib/ai/tools/assistant/bots/create-repository.summary";
import { createTemplateSummary } from "@/lib/ai/tools/assistant/bots/create-template.summary";
import { deleteAssetSummary } from "@/lib/ai/tools/assistant/bots/delete-asset.summary";
import { deleteBlockSummary } from "@/lib/ai/tools/assistant/bots/delete-block.summary";
import { deleteBotSummary } from "@/lib/ai/tools/assistant/bots/delete-bot.summary";
import { publishBotSummary } from "@/lib/ai/tools/assistant/bots/publish-bot.summary";
import { requestUploadSummary } from "@/lib/ai/tools/assistant/bots/request-upload.summary";
import { retryAssetSummary } from "@/lib/ai/tools/assistant/bots/retry-asset.summary";
import { updateAssetSummary } from "@/lib/ai/tools/assistant/bots/update-asset.summary";
import { updateBotSummary } from "@/lib/ai/tools/assistant/bots/update-bot.summary";
import { updateRepositorySummary } from "@/lib/ai/tools/assistant/bots/update-repository.summary";
import { updateTemplateSummary } from "@/lib/ai/tools/assistant/bots/update-template.summary";
import { findAssetsSummary } from "@/lib/ai/tools/assistant/core/find-assets.summary";
import { findBlocksSummary } from "@/lib/ai/tools/assistant/core/find-blocks.summary";
import { findBotsSummary } from "@/lib/ai/tools/assistant/core/find-bots.summary";
import { getBlockSummary } from "@/lib/ai/tools/assistant/core/get-block.summary";
import { getBotSummary } from "@/lib/ai/tools/assistant/core/get-bot.summary";
import { listGroupsSummary } from "@/lib/ai/tools/assistant/core/list-groups.summary";
import { listMembersSummary } from "@/lib/ai/tools/assistant/core/list-members.summary";
import { loadToolsSummary } from "@/lib/ai/tools/assistant/core/load-tools.summary";
import type { AssistantToolName } from "@/lib/ai/tools/assistant/groups";
import { addGroupMembersSummary } from "@/lib/ai/tools/assistant/people/add-group-members.summary";
import { cancelInvitationSummary } from "@/lib/ai/tools/assistant/people/cancel-invitation.summary";
import { changeMemberRoleSummary } from "@/lib/ai/tools/assistant/people/change-member-role.summary";
import { createGroupSummary } from "@/lib/ai/tools/assistant/people/create-group.summary";
import { deleteGroupSummary } from "@/lib/ai/tools/assistant/people/delete-group.summary";
import { inviteMembersSummary } from "@/lib/ai/tools/assistant/people/invite-members.summary";
import { listGroupMembersSummary } from "@/lib/ai/tools/assistant/people/list-group-members.summary";
import { listInvitationsSummary } from "@/lib/ai/tools/assistant/people/list-invitations.summary";
import { removeGroupMembersSummary } from "@/lib/ai/tools/assistant/people/remove-group-members.summary";
import { removeMembersSummary } from "@/lib/ai/tools/assistant/people/remove-members.summary";
import { updateGroupSummary } from "@/lib/ai/tools/assistant/people/update-group.summary";
import { updatePlanSummary } from "@/lib/ai/tools/assistant/plan/update-plan.summary";
import { findPrincipalsSummary } from "@/lib/ai/tools/assistant/sharing/find-principals.summary";
import { grantAccessSummary } from "@/lib/ai/tools/assistant/sharing/grant-access.summary";
import { listAccessSummary } from "@/lib/ai/tools/assistant/sharing/list-access.summary";
import { revokeAccessSummary } from "@/lib/ai/tools/assistant/sharing/revoke-access.summary";
import type {
	AssistantToolPart,
	AssistantToolSummary,
} from "@/lib/ai/tools/assistant/summary";

/** The assistant tools with a summary; `readDocs` and the display tools have their own renderers. */
export type SummarisedToolName = Exclude<
	AssistantToolName,
	"readDocs" | DisplayToolName
>;

export type SummarisedToolPart = AssistantToolPart<SummarisedToolName>;

type SummaryRegistry = {
	[Name in SummarisedToolName as `tool-${Name}`]: AssistantToolSummary<Name>;
};

export const assistantToolSummaries: SummaryRegistry = {
	"tool-findBots": findBotsSummary,
	"tool-getBot": getBotSummary,
	"tool-findBlocks": findBlocksSummary,
	"tool-getBlock": getBlockSummary,
	"tool-findAssets": findAssetsSummary,
	"tool-listGroups": listGroupsSummary,
	"tool-listMembers": listMembersSummary,
	"tool-loadTools": loadToolsSummary,
	"tool-updatePlan": updatePlanSummary,
	"tool-createBot": createBotSummary,
	"tool-updateBot": updateBotSummary,
	"tool-publishBot": publishBotSummary,
	"tool-deleteBot": deleteBotSummary,
	"tool-createTemplate": createTemplateSummary,
	"tool-updateTemplate": updateTemplateSummary,
	"tool-createRepository": createRepositorySummary,
	"tool-updateRepository": updateRepositorySummary,
	"tool-deleteBlock": deleteBlockSummary,
	"tool-updateAsset": updateAssetSummary,
	"tool-deleteAsset": deleteAssetSummary,
	"tool-retryAsset": retryAssetSummary,
	"tool-requestUpload": requestUploadSummary,
	"tool-listAccess": listAccessSummary,
	"tool-findPrincipals": findPrincipalsSummary,
	"tool-grantAccess": grantAccessSummary,
	"tool-revokeAccess": revokeAccessSummary,
	"tool-createGroup": createGroupSummary,
	"tool-updateGroup": updateGroupSummary,
	"tool-deleteGroup": deleteGroupSummary,
	"tool-addGroupMembers": addGroupMembersSummary,
	"tool-removeGroupMembers": removeGroupMembersSummary,
	"tool-listGroupMembers": listGroupMembersSummary,
	"tool-changeMemberRole": changeMemberRoleSummary,
	"tool-removeMembers": removeMembersSummary,
	"tool-inviteMembers": inviteMembersSummary,
	"tool-listInvitations": listInvitationsSummary,
	"tool-cancelInvitation": cancelInvitationSummary,
};

/** One summary over every summarised part; the registry pairs each with its own type. */
export type AnyToolSummary = AssistantToolSummary<SummarisedToolName>;

const registry = assistantToolSummaries as unknown as Record<
	string,
	AnyToolSummary
>;

export const isSummarisedToolPart = (
	part: ToolPart,
): part is SummarisedToolPart => Object.hasOwn(registry, part.type);

export const toolSummaryOf = (part: SummarisedToolPart): AnyToolSummary =>
	registry[part.type];

/** The summary of a tool by name, for server code without UI parts. */
export const toolSummaryByName = (
	toolName: string,
): AnyToolSummary | undefined =>
	Object.hasOwn(registry, `tool-${toolName}`)
		? registry[`tool-${toolName}`]
		: undefined;
