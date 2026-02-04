import { assetTable } from "./asset";
import { account, session, user, verification } from "./auth";
import { blockAssetTable, blockTable, chatBlockTable } from "./block";
import { botBlockTable, botTable } from "./bot";
import { chat } from "./chat";
import { chatBranch } from "./chat-branch";
import { chatMessage } from "./chat-message";
import { course, courseMember } from "./course";
import { courseInvitation } from "./course-invitation";
import {
	capabilityTable,
	modelCapabilityTable,
	modelTable,
	organizationProviderTable,
	providerTable,
} from "./model";
import { invitation, member, organization } from "./organization";
import { taskTable } from "./task";

export const dbSchema = {
	user,
	session,
	account,
	verification,
	assetTable,
	blockTable,
	chatBlockTable,
	blockAssetTable,
	botTable,
	botBlockTable,
	chatBranch,
	chatMessage,
	chat,
	courseInvitation,
	course,
	courseMember,
	providerTable,
	modelTable,
	capabilityTable,
	modelCapabilityTable,
	organizationProviderTable,
	organization,
	member,
	invitation,
	taskTable,
};
