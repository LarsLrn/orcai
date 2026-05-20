import type {
	ContractRouterClient,
	InferContractRouterInputs,
	InferContractRouterOutputs,
} from "@orpc/contract";
import { assetContracts } from "./asset";
import { assetPointContracts } from "./asset-point";
import { chatContracts } from "./chat";
import { jobContracts } from "./job";
import { modelContracts } from "./model";
import { organizationContracts } from "./organization";
import { organizationMemberContracts } from "./organization-member";
import { providerContracts } from "./provider";
import { quotaContracts } from "./quota";

export const contracts = {
	asset: assetContracts,
	assetPoint: assetPointContracts,
	chat: chatContracts,
	job: jobContracts,
	model: modelContracts,
	organization: organizationContracts,
	organizationMember: organizationMemberContracts,
	provider: providerContracts,
	quota: quotaContracts,
};

export type ContractInputs = InferContractRouterInputs<typeof contracts>;
export type ContractOutputs = InferContractRouterOutputs<typeof contracts>;
export type ContractClient = ContractRouterClient<typeof contracts>;

export { base } from "./base";
export {
	assetContracts,
	assetPointContracts,
	chatContracts,
	jobContracts,
	modelContracts,
	organizationContracts,
	organizationMemberContracts,
	providerContracts,
	quotaContracts,
};
