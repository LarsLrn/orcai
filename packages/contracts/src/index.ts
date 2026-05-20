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
import { providerContracts } from "./provider";

export const contracts = {
	asset: assetContracts,
	assetPoint: assetPointContracts,
	chat: chatContracts,
	job: jobContracts,
	model: modelContracts,
	organization: organizationContracts,
	provider: providerContracts,
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
	providerContracts,
};
