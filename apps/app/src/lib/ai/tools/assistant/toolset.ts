import type { AssistantSession } from "@/lib/ai/agents/assistant-session";
import { createBotTool } from "./bots/create-bot";
import { createRepositoryTool } from "./bots/create-repository";
import { createTemplateTool } from "./bots/create-template";
import { deleteAssetTool } from "./bots/delete-asset";
import { deleteBlockTool } from "./bots/delete-block";
import { deleteBotTool } from "./bots/delete-bot";
import { publishBotTool } from "./bots/publish-bot";
import { requestUploadTool } from "./bots/request-upload";
import { retryAssetTool } from "./bots/retry-asset";
import { updateAssetTool } from "./bots/update-asset";
import { updateBotTool } from "./bots/update-bot";
import { updateRepositoryTool } from "./bots/update-repository";
import { updateTemplateTool } from "./bots/update-template";
import { findAssetsTool } from "./core/find-assets";
import { findBlocksTool } from "./core/find-blocks";
import { findBotsTool } from "./core/find-bots";
import { getBlockTool } from "./core/get-block";
import { getBotTool } from "./core/get-bot";
import { listGroupsTool } from "./core/list-groups";
import { listMembersTool } from "./core/list-members";
import { loadToolsTool } from "./core/load-tools";
import { addGroupMembersTool } from "./people/add-group-members";
import { cancelInvitationTool } from "./people/cancel-invitation";
import { changeMemberRoleTool } from "./people/change-member-role";
import { createGroupTool } from "./people/create-group";
import { deleteGroupTool } from "./people/delete-group";
import { inviteMembersTool } from "./people/invite-members";
import { listGroupMembersTool } from "./people/list-group-members";
import { listInvitationsTool } from "./people/list-invitations";
import { removeGroupMembersTool } from "./people/remove-group-members";
import { removeMembersTool } from "./people/remove-members";
import { updateGroupTool } from "./people/update-group";
import { updatePlanTool } from "./plan/update-plan";
import type { AssistantToolDeps } from "./procedure-tool";
import { findPrincipalsTool } from "./sharing/find-principals";
import { grantAccessTool } from "./sharing/grant-access";
import { listAccessTool } from "./sharing/list-access";
import { revokeAccessTool } from "./sharing/revoke-access";

/** Every assistant tool with the caller's context; the agent picks the active ones per step. */
export const buildAssistantTools = ({
	session,
	...deps
}: AssistantToolDeps & {
	session: AssistantSession;
}) => ({
	findBots: findBotsTool(deps),
	getBot: getBotTool(deps),
	getBlock: getBlockTool(deps),
	findBlocks: findBlocksTool(deps),
	findAssets: findAssetsTool(deps),
	listGroups: listGroupsTool(deps),
	listMembers: listMembersTool(deps),
	loadTools: loadToolsTool(session),
	updatePlan: updatePlanTool(session),
	createBot: createBotTool(deps),
	updateBot: updateBotTool(deps),
	publishBot: publishBotTool(deps),
	deleteBot: deleteBotTool(deps),
	createTemplate: createTemplateTool(deps),
	updateTemplate: updateTemplateTool(deps),
	createRepository: createRepositoryTool(deps),
	updateRepository: updateRepositoryTool(deps),
	deleteBlock: deleteBlockTool(deps),
	updateAsset: updateAssetTool(deps),
	deleteAsset: deleteAssetTool(deps),
	retryAsset: retryAssetTool(deps),
	requestUpload: requestUploadTool,
	listAccess: listAccessTool(deps),
	findPrincipals: findPrincipalsTool(deps),
	grantAccess: grantAccessTool(deps),
	revokeAccess: revokeAccessTool(deps),
	createGroup: createGroupTool(deps),
	updateGroup: updateGroupTool(deps),
	deleteGroup: deleteGroupTool(deps),
	addGroupMembers: addGroupMembersTool(deps),
	removeGroupMembers: removeGroupMembersTool(deps),
	listGroupMembers: listGroupMembersTool(deps),
	changeMemberRole: changeMemberRoleTool(deps),
	removeMembers: removeMembersTool(deps),
	inviteMembers: inviteMembersTool(deps),
	listInvitations: listInvitationsTool(deps),
	cancelInvitation: cancelInvitationTool(deps),
});
