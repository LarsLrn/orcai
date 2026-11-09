import type { Tool } from "ai";
import type { AssistantSession } from "@/lib/ai/tools/assistant/session";
import { readDocsTool } from "@/lib/ai/tools/docs/read-docs";
import { buildGenUiTools } from "@/lib/ai/tools/gen-ui/catalog";
import { askUserTool } from "@/lib/ai/tools/questions/ask-user";
import type { QuizHistoryMessage } from "@/lib/ai/tools/questions/quiz-result";
import { buildQuestionTools } from "@/lib/ai/tools/questions/toolset";
import type { DocsConfig } from "@/lib/effect/services/config";
import { findPeopleTool } from "./access/find-people";
import { grantAccessTool } from "./access/grant-access";
import { listAccessTool } from "./access/list-access";
import { revokeAccessTool } from "./access/revoke-access";
import { deleteAssetTool } from "./assets/delete-asset";
import { findAssetsTool } from "./assets/find-assets";
import { generateAssetMetadataTool } from "./assets/generate-asset-metadata";
import { prepareAssetAgainTool } from "./assets/prepare-asset-again";
import { requestUploadTool } from "./assets/request-upload";
import { updateAssetTool } from "./assets/update-asset";
import { createBehaviourTool } from "./blocks/create-behaviour";
import { createRepositoryTool } from "./blocks/create-repository";
import { deleteBlockTool } from "./blocks/delete-block";
import { findBlocksTool } from "./blocks/find-blocks";
import { getBlockTool } from "./blocks/get-block";
import { updateBehaviourTool } from "./blocks/update-behaviour";
import { updateRepositoryTool } from "./blocks/update-repository";
import { createBotTool } from "./bots/create-bot";
import { deleteBotTool } from "./bots/delete-bot";
import { findBotsTool } from "./bots/find-bots";
import { findModelsTool } from "./bots/find-models";
import { getBotTool } from "./bots/get-bot";
import { publishBotTool } from "./bots/publish-bot";
import { updateBotTool } from "./bots/update-bot";
import { updateBotSetupTool } from "./bots/update-bot-setup";
import { addFromCatalogueTool } from "./catalogue/add-from-catalogue";
import { findCatalogueTool } from "./catalogue/find-catalogue";
import { removeFromOrganisationTool } from "./catalogue/remove-from-organisation";
import {
	ASSISTANT_TOOL_NAMES,
	type AssistantToolName,
	CONFIRMED_TOOLS,
} from "./groups";
import { addGroupMembersTool } from "./groups/add-group-members";
import { createGroupTool } from "./groups/create-group";
import { deleteGroupTool } from "./groups/delete-group";
import { listGroupMembersTool } from "./groups/list-group-members";
import { listGroupsTool } from "./groups/list-groups";
import { removeGroupMembersTool } from "./groups/remove-group-members";
import { updateGroupTool } from "./groups/update-group";
import { loadToolsTool } from "./load-tools";
import { cancelInvitationTool } from "./members/cancel-invitation";
import { changeMemberRoleTool } from "./members/change-member-role";
import { inviteMembersTool } from "./members/invite-members";
import { listInvitationsTool } from "./members/list-invitations";
import { listMembersTool } from "./members/list-members";
import { removeMembersTool } from "./members/remove-members";
import { updatePlanTool } from "./plan/update-plan";
import type { AssistantToolDeps } from "./procedure-tool";

type BuildDeps = AssistantToolDeps & {
	session: AssistantSession;
	docs: DocsConfig | undefined;
	/** The stored conversation, whose latest quiz showQuizResult grades. */
	history: readonly QuizHistoryMessage[];
};

// Prose fields cite docs pages, the Assistant's only citable source.
const displayTools = {
	docs: buildGenUiTools({
		citations: true,
	}),
	none: buildGenUiTools({
		citations: false,
	}),
};

const displayToolsFor = (docs: DocsConfig | undefined) =>
	docs ? displayTools.docs : displayTools.none;

const builds = {
	readDocs: ({ docs }: BuildDeps) =>
		readDocsTool({
			docs,
		}),
	askUser: () => askUserTool,
	showChecklist: ({ docs }: BuildDeps) => displayToolsFor(docs).showChecklist,
	showReview: ({ docs }: BuildDeps) => displayToolsFor(docs).showReview,
	showMatrix: ({ docs }: BuildDeps) => displayToolsFor(docs).showMatrix,
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
