import type { Tool } from "ai";
import { buildGenUiTools } from "@/components/chat/gen-ui/catalog";
import type { AssistantSession } from "@/lib/ai/agents/assistant-session";
import { readDocsTool } from "@/lib/ai/tools/docs/read-docs";
import { askUserTool } from "@/lib/ai/tools/questions/ask-user";
import type { QuizHistoryMessage } from "@/lib/ai/tools/questions/quiz-result";
import { buildQuestionTools } from "@/lib/ai/tools/questions/toolset";
import type { DocsConfig } from "@/lib/effect/services/config";
import { createBehaviourTool } from "./bots/create-behaviour";
import { createBotTool } from "./bots/create-bot";
import { createRepositoryTool } from "./bots/create-repository";
import { deleteAssetTool } from "./bots/delete-asset";
import { deleteBlockTool } from "./bots/delete-block";
import { deleteBotTool } from "./bots/delete-bot";
import { findModelsTool } from "./bots/find-models";
import { generateAssetMetadataTool } from "./bots/generate-asset-metadata";
import { prepareAssetAgainTool } from "./bots/prepare-asset-again";
import { publishBotTool } from "./bots/publish-bot";
import { requestUploadTool } from "./bots/request-upload";
import { updateAssetTool } from "./bots/update-asset";
import { updateBehaviourTool } from "./bots/update-behaviour";
import { updateBotTool } from "./bots/update-bot";
import { updateRepositoryTool } from "./bots/update-repository";
import { addFromCatalogueTool } from "./catalogue/add-from-catalogue";
import { findCatalogueTool } from "./catalogue/find-catalogue";
import { removeFromOrganisationTool } from "./catalogue/remove-from-organisation";
import { updateBotSetupTool } from "./catalogue/update-bot-setup";
import { findAssetsTool } from "./core/find-assets";
import { findBlocksTool } from "./core/find-blocks";
import { findBotsTool } from "./core/find-bots";
import { getBlockTool } from "./core/get-block";
import { getBotTool } from "./core/get-bot";
import { listGroupsTool } from "./core/list-groups";
import { listMembersTool } from "./core/list-members";
import { loadToolsTool } from "./core/load-tools";
import {
	ASSISTANT_TOOL_NAMES,
	type AssistantToolName,
	CONFIRMED_TOOLS,
} from "./groups";
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
import { findPeopleTool } from "./sharing/find-people";
import { grantAccessTool } from "./sharing/grant-access";
import { listAccessTool } from "./sharing/list-access";
import { revokeAccessTool } from "./sharing/revoke-access";

type BuildDeps = AssistantToolDeps & {
	session: AssistantSession;
	docs: DocsConfig | undefined;
	/** The stored conversation, whose latest quiz showQuizResult grades. */
	history: readonly QuizHistoryMessage[];
};

const displayTools = buildGenUiTools();

const builds = {
	readDocs: ({ docs }: BuildDeps) =>
		readDocsTool({
			docs,
		}),
	askUser: () => askUserTool,
	showChecklist: () => displayTools.showChecklist,
	showReview: () => displayTools.showReview,
	showMatrix: () => displayTools.showMatrix,
	showQuizResult: ({ history }: BuildDeps) =>
		buildQuestionTools({
			history,
		}).showQuizResult,
	findBots: findBotsTool,
	getBot: getBotTool,
	getBlock: getBlockTool,
	findBlocks: findBlocksTool,
	findAssets: findAssetsTool,
	listGroups: listGroupsTool,
	listMembers: listMembersTool,
	loadTools: ({ session }: BuildDeps) => loadToolsTool(session),
	updatePlan: ({ session }: BuildDeps) => updatePlanTool(session),
	findModels: findModelsTool,
	findCatalogue: findCatalogueTool,
	createBot: createBotTool,
	updateBot: updateBotTool,
	updateBotSetup: updateBotSetupTool,
	publishBot: publishBotTool,
	deleteBot: deleteBotTool,
	createBehaviour: createBehaviourTool,
	updateBehaviour: updateBehaviourTool,
	createRepository: createRepositoryTool,
	updateRepository: updateRepositoryTool,
	deleteBlock: deleteBlockTool,
	updateAsset: updateAssetTool,
	deleteAsset: deleteAssetTool,
	prepareAssetAgain: prepareAssetAgainTool,
	generateAssetMetadata: generateAssetMetadataTool,
	requestUpload: () => requestUploadTool,
	addFromCatalogue: addFromCatalogueTool,
	removeFromOrganisation: removeFromOrganisationTool,
	listAccess: listAccessTool,
	findPeople: findPeopleTool,
	grantAccess: grantAccessTool,
	revokeAccess: revokeAccessTool,
	createGroup: createGroupTool,
	updateGroup: updateGroupTool,
	deleteGroup: deleteGroupTool,
	addGroupMembers: addGroupMembersTool,
	removeGroupMembers: removeGroupMembersTool,
	listGroupMembers: listGroupMembersTool,
	changeMemberRole: changeMemberRoleTool,
	removeMembers: removeMembersTool,
	inviteMembers: inviteMembersTool,
	listInvitations: listInvitationsTool,
	cancelInvitation: cancelInvitationTool,
} satisfies Record<AssistantToolName, (deps: BuildDeps) => Tool>;

type AssistantTools = {
	[Name in AssistantToolName]: ReturnType<(typeof builds)[Name]>;
};

/** Every assistant tool with the caller's context, in registry order; the session picks the active ones per step. */
export const buildAssistantTools = (deps: BuildDeps): AssistantTools =>
	Object.fromEntries(
		ASSISTANT_TOOL_NAMES.map((name) => {
			const built: Tool = builds[name](deps);

			return [
				name,
				CONFIRMED_TOOLS.has(name)
					? {
							...built,
							description: `${built.description} The user confirms before it runs.`,
						}
					: built,
			];
		}),
	) as AssistantTools;
