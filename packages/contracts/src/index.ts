import type {
	ContractRouterClient,
	InferContractRouterInputs,
	InferContractRouterOutputs,
} from "@orpc/contract";
import { assetContracts } from "./asset";
import { assetPointContracts } from "./asset-point";
import { blockContracts } from "./block";
import { chatContracts } from "./chat";
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
import { userContracts } from "./user";

export const contracts = {
	asset: assetContracts,
	assetPoint: assetPointContracts,
	block: blockContracts,
	chat: chatContracts,
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
	user: userContracts,
};

export type ContractInputs = InferContractRouterInputs<typeof contracts>;
export type ContractOutputs = InferContractRouterOutputs<typeof contracts>;
export type ContractClient = ContractRouterClient<typeof contracts>;

export { base } from "./base";
export {
	assetContracts,
	assetPointContracts,
	blockContracts,
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
	userContracts,
};
