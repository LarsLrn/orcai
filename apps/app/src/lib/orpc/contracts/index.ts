import { contracts as sharedContracts } from "@orcai/contracts";
import type {
	InferContractRouterErrorMap,
	InferContractRouterInputs,
	InferContractRouterOutputs,
} from "@orpc/contract";
import type { ORPCErrorConstructorMap } from "@orpc/server";
import { aiChatContract } from "./ai";
import {
	createBlockContract,
	deleteBlockContract,
	findBlockContract,
	listBlocksContract,
	updateBlockContract,
} from "./block";
import {
	bootstrapInitializeContract,
	bootstrapStatusContract,
} from "./bootstrap";
import {
	deleteBotContract,
	findBotContract,
	findBotEditorContract,
	listBotsContract,
	listDraftBotsContract,
	publishBotContract,
	saveBotContract,
} from "./bot";
import {
	attachChatBlockContract,
	detachChatBlockContract,
	listChatBlocksContract,
} from "./chat-block";
import {
	abortMultipartUploadContract,
	completeMultipartUploadContract,
	createDownloadUrlContract,
	createUploadUrlsContract,
	finalizeUploadContract,
} from "./storage";

export const contracts = {
	bootstrap: {
		status: bootstrapStatusContract,
		initialize: bootstrapInitializeContract,
	},
	organization: sharedContracts.organization,
	organizationMember: sharedContracts.organizationMember,
	organizationInvitation: sharedContracts.organizationInvitation,
	provider: sharedContracts.provider,
	quota: sharedContracts.quota,
	resource: sharedContracts.resource,
	group: sharedContracts.group,
	chat: sharedContracts.chat,
	chatBlock: {
		list: listChatBlocksContract,
		attach: attachChatBlockContract,
		detach: detachChatBlockContract,
	},
	chatMessage: sharedContracts.chatMessage,
	block: {
		list: listBlocksContract,
		find: findBlockContract,
		create: createBlockContract,
		update: updateBlockContract,
		delete: deleteBlockContract,
	},
	bot: {
		list: listBotsContract,
		listDrafts: listDraftBotsContract,
		find: findBotContract,
		findEditor: findBotEditorContract,
		save: saveBotContract,
		publish: publishBotContract,
		delete: deleteBotContract,
	},
	asset: sharedContracts.asset,
	assetPoint: sharedContracts.assetPoint,
	user: sharedContracts.user,
	model: sharedContracts.model,
	storage: {
		createUploadUrls: createUploadUrlsContract,
		createDownloadUrl: createDownloadUrlContract,
		finalizeUpload: finalizeUploadContract,
		completeMultipartUpload: completeMultipartUploadContract,
		abortMultipartUpload: abortMultipartUploadContract,
	},
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
