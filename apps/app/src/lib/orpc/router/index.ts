import { aiRouter } from "./ai";
import { analyticsRouter } from "./analytics";
import { assetRouter } from "./asset";
import { assetPointRouter } from "./asset-point";
import { assistantRouter } from "./assistant";
import { authorizationRouter } from "./authorization";
import { blockRouter } from "./block";
import { bootstrapRouter } from "./bootstrap";
import { botRouter } from "./bot";
import { chatRouter } from "./chat";
import { chatBlockRouter } from "./chat-block";
import { chatMessageRouter } from "./chat-message";
import { groupRouter } from "./group";
import { modelRouter } from "./model";
import { organizationRouter } from "./organization";
import { organizationInvitationRouter } from "./organization-invitation";
import { organizationMemberRouter } from "./organization-member";
import { providerRouter } from "./provider";
import { quotaRouter } from "./quota";
import { resourceRouter } from "./resource";
import { storageRouter } from "./storage";
import { userRouter } from "./user";

export const router = {
	bootstrap: bootstrapRouter,
	organization: organizationRouter,
	organizationMember: organizationMemberRouter,
	organizationInvitation: organizationInvitationRouter,
	provider: providerRouter,
	quota: quotaRouter,
	resource: resourceRouter,
	group: groupRouter,
	assistant: assistantRouter,
	chat: chatRouter,
	chatBlock: chatBlockRouter,
	chatMessage: chatMessageRouter,
	block: blockRouter,
	bot: botRouter,
	asset: assetRouter,
	assetPoint: assetPointRouter,
	authorization: authorizationRouter,
	user: userRouter,
	storage: storageRouter,
	model: modelRouter,
	ai: aiRouter,
	analytics: analyticsRouter,
};
