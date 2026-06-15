import { contracts as sharedContracts } from "@orcai/contracts";
import type {
	InferContractRouterErrorMap,
	InferContractRouterInputs,
	InferContractRouterOutputs,
} from "@orpc/contract";
import type { ORPCErrorConstructorMap } from "@orpc/server";
import { aiChatContract } from "./ai";

export const contracts = {
	bootstrap: sharedContracts.bootstrap,
	organization: sharedContracts.organization,
	organizationMember: sharedContracts.organizationMember,
	organizationInvitation: sharedContracts.organizationInvitation,
	provider: sharedContracts.provider,
	quota: sharedContracts.quota,
	resource: sharedContracts.resource,
	group: sharedContracts.group,
	chat: sharedContracts.chat,
	chatBlock: sharedContracts.chatBlock,
	chatMessage: sharedContracts.chatMessage,
	block: sharedContracts.block,
	bot: sharedContracts.bot,
	asset: sharedContracts.asset,
	assetPoint: sharedContracts.assetPoint,
	user: sharedContracts.user,
	model: sharedContracts.model,
	storage: sharedContracts.storage,
	job: sharedContracts.job,
	ai: {
		chat: aiChatContract,
	},
};

export type OrpcInputs = InferContractRouterInputs<typeof contracts>;
export type OrpcOutputs = InferContractRouterOutputs<typeof contracts>;

export type OrpcErrors = ORPCErrorConstructorMap<
	InferContractRouterErrorMap<typeof contracts>
>;
