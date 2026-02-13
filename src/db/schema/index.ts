import { asset } from "./asset";
import { account, session, user, verification } from "./auth";
import { block, blockAsset, chatBlock } from "./block";
import { bot, botBlock } from "./bot";
import { chat } from "./chat";
import { chatBranch } from "./chat-branch";
import { chatMessage } from "./chat-message";
import { course, courseMember } from "./course";
import { courseInvitation } from "./course-invitation";
import { model, provider } from "./model";
import { invitation, member, organization } from "./organization";
import { task } from "./task";

export const dbSchema = {
	user,
	session,
	account,
	verification,
	asset,
	block,
	chatBlock,
	blockAsset,
	bot,
	botBlock,
	chatBranch,
	chatMessage,
	chat,
	courseInvitation,
	course,
	courseMember,
	model,
	provider,
	organization,
	member,
	invitation,
	task,
};
