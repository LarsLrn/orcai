import type {
	ContractRouterClient,
	InferContractRouterInputs,
	InferContractRouterOutputs,
} from "@orpc/contract";
import { assetContracts } from "./asset";
import { assetPointContracts } from "./asset-point";
import { jobContracts } from "./job";
import { modelContracts } from "./model";

export const contracts = {
	asset: assetContracts,
	assetPoint: assetPointContracts,
	job: jobContracts,
	model: modelContracts,
};

export type ContractInputs = InferContractRouterInputs<typeof contracts>;
export type ContractOutputs = InferContractRouterOutputs<typeof contracts>;
export type ContractClient = ContractRouterClient<typeof contracts>;

export { base } from "./base";
export { assetContracts, assetPointContracts, jobContracts, modelContracts };
