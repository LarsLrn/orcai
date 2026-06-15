import type {
	ContractRouterClient,
	InferContractRouterErrorMap,
	InferContractRouterInputs,
	InferContractRouterOutputs,
} from "@orpc/contract";
import { aiContracts } from "./ai";
import { assetContracts } from "./asset";
import { assetPointContracts } from "./asset-point";
import { blockContracts } from "./block";
import { bootstrapContracts } from "./bootstrap";
import { botContracts } from "./bot";
import { chatContracts } from "./chat";
import { chatBlockContracts } from "./chat-block";
import { chatMessageContracts } from "./chat-message";
import { groupContracts } from "./group";
import { jobContracts } from "./job";
import { modelContracts } from "./model";
import { organizationContracts } from "./organization";
import { organizationInvitationContracts } from "./organization-invitation";
import { organizationMemberContracts } from "./organization-member";
import { providerContracts } from "./provider";
import { quotaContracts } from "./quota";
import { resourceContracts } from "./resource";
import { storageContracts } from "./storage";
import { userContracts } from "./user";

export const contracts = {
	ai: aiContracts,
	asset: assetContracts,
	assetPoint: assetPointContracts,
	block: blockContracts,
	bot: botContracts,
	bootstrap: bootstrapContracts,
	chat: chatContracts,
	chatBlock: chatBlockContracts,
	chatMessage: chatMessageContracts,
	group: groupContracts,
	job: jobContracts,
	model: modelContracts,
	organization: organizationContracts,
	organizationInvitation: organizationInvitationContracts,
	organizationMember: organizationMemberContracts,
	provider: providerContracts,
	quota: quotaContracts,
	resource: resourceContracts,
	storage: storageContracts,
	user: userContracts,
};

export type ContractInputs = InferContractRouterInputs<typeof contracts>;
export type ContractOutputs = InferContractRouterOutputs<typeof contracts>;
export type ContractErrors = InferContractRouterErrorMap<typeof contracts>;
export type ContractClient = ContractRouterClient<typeof contracts>;

export { base } from "./base";
export {
	aiContracts,
	assetContracts,
	assetPointContracts,
	blockContracts,
	bootstrapContracts,
	botContracts,
	chatBlockContracts,
	chatContracts,
	chatMessageContracts,
	groupContracts,
	jobContracts,
	modelContracts,
	organizationContracts,
	organizationInvitationContracts,
	organizationMemberContracts,
	providerContracts,
	quotaContracts,
	resourceContracts,
	storageContracts,
	userContracts,
};
