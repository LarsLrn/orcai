import { asset } from "./asset";
import { account, session, user, verification } from "./auth";
import {
	authzOutbox,
	authzOutboxStatusEnum,
	courseBot,
	group,
	groupKindEnum,
	groupMember,
	groupSystemKeyEnum,
	principalTypeEnum,
	resourceGrant,
	resourceGrantRoleEnum,
	resourceScope,
	resourceTypeEnum,
	resourceVisibility,
	resourceVisibilityEnum,
} from "./authz";
import { block, blockAsset, chatBlock } from "./block";
import { bot, botBlock } from "./bot";
import { chat } from "./chat";
import { chatBranch } from "./chat-branch";
import { chatMessage } from "./chat-message";
import { course } from "./course";
import { model, provider } from "./model";
import { invitation, member, organization } from "./organization";

export const dbSchema = {
	user,
	session,
	account,
	verification,
	authzOutbox,
	asset,
	block,
	chatBlock,
	blockAsset,
	bot,
	botBlock,
	chatBranch,
	chatMessage,
	chat,
	course,
	courseBot,
	group,
	groupMember,
	model,
	provider,
	organization,
	member,
	invitation,
	resourceGrant,
	resourceScope,
	resourceVisibility,
};

export const enumSchema = {
	authzOutboxStatusEnum,
	groupKindEnum,
	groupSystemKeyEnum,
	principalTypeEnum,
	resourceGrantRoleEnum,
	resourceTypeEnum,
	resourceVisibilityEnum,
};
