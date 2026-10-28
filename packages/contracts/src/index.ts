import type {
	InferRouterContractErrorMap,
	InferRouterContractInputs,
	InferRouterContractOutputs,
	RouterContractClient,
} from "@orpc/contract";
import { aiContracts } from "./ai";
import { analyticsContracts } from "./analytics";
import { assetContracts } from "./asset";
import { assetPointContracts } from "./asset-point";
import { assistantContracts } from "./assistant";
import { authorizationContracts } from "./authorization";
import { blockContracts } from "./block";
import { bootstrapContracts } from "./bootstrap";
import { botContracts } from "./bot";
import { botSetupContracts } from "./bot-setup";
import { chatContracts } from "./chat";
import { chatBlockContracts } from "./chat-block";
import { chatMessageContracts } from "./chat-message";
import { dataExportContracts } from "./data-export";
import { groupContracts } from "./group";
import { healthContracts } from "./health";
import { instanceContracts } from "./instance";
import { modelContracts } from "./model";
import { organizationContracts } from "./organization";
import { organizationInvitationContracts } from "./organization-invitation";
import { organizationMemberContracts } from "./organization-member";
import { providerContracts } from "./provider";
import { quotaContracts } from "./quota";
import { readinessContracts } from "./readiness";
import { resourceContracts } from "./resource";
import { storageContracts } from "./storage";
import { userContracts } from "./user";

export const contracts = {
	ai: aiContracts,
	analytics: analyticsContracts,
	asset: assetContracts,
	assetPoint: assetPointContracts,
	assistant: assistantContracts,
	authorization: authorizationContracts,
	block: blockContracts,
	bot: botContracts,
	botSetup: botSetupContracts,
	bootstrap: bootstrapContracts,
	chat: chatContracts,
	chatBlock: chatBlockContracts,
	chatMessage: chatMessageContracts,
	dataExport: dataExportContracts,
	group: groupContracts,
	health: healthContracts,
	instance: instanceContracts,
	model: modelContracts,
	organization: organizationContracts,
	organizationInvitation: organizationInvitationContracts,
	organizationMember: organizationMemberContracts,
	provider: providerContracts,
	quota: quotaContracts,
	readiness: readinessContracts,
	resource: resourceContracts,
	storage: storageContracts,
	user: userContracts,
};

export type ContractInputs = InferRouterContractInputs<typeof contracts>;
export type ContractOutputs = InferRouterContractOutputs<typeof contracts>;
export type ContractErrors = InferRouterContractErrorMap<typeof contracts>;
export type ContractClient = RouterContractClient<typeof contracts>;

export { base } from "./base";
export {
	aiContracts,
	analyticsContracts,
	assetContracts,
	assetPointContracts,
	assistantContracts,
	authorizationContracts,
	blockContracts,
	bootstrapContracts,
	botContracts,
	botSetupContracts,
	chatBlockContracts,
	chatContracts,
	chatMessageContracts,
	dataExportContracts,
	groupContracts,
	healthContracts,
	instanceContracts,
	modelContracts,
	organizationContracts,
	organizationInvitationContracts,
	organizationMemberContracts,
	providerContracts,
	quotaContracts,
	readinessContracts,
	resourceContracts,
	storageContracts,
	userContracts,
};
