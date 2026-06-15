import { aiChat } from "./ai";
import {
	createAsset,
	deleteAssets,
	findAsset,
	listAssets,
	saveAsset,
	saveManyAssets,
} from "./asset";
import { listAssetPoint } from "./asset-point";
import {
	createBlock,
	deleteBlocks,
	findBlock,
	listBlocks,
	updateBlock,
} from "./block";
import { getBootstrapStatus, initializeBootstrap } from "./bootstrap";
import {
	deleteBots,
	findBot,
	findBotEditor,
	listBots,
	listDraftBots,
	publishBot,
	saveBot,
} from "./bot";
import {
	createChat,
	deleteChats,
	findChat,
	listChats,
	updateChat,
} from "./chat";
import { attachChatBlock, detachChatBlock, listChatBlocks } from "./chat-block";
import {
	createChatMessage,
	deleteChatMessages,
	findChatMessage,
	getBranchIdForMessage,
	listChatMessages,
	rateChatMessage,
	updateChatMessage,
} from "./chat-message";
import {
	addGroupMembers,
	createGroup,
	deleteGroups,
	findGroup,
	listGroupMembers,
	listGroups,
	removeGroupMembers,
	updateGroup,
} from "./group";
import {
	createJobs,
	listJobs,
	retryProcessing,
	retryVectorization,
} from "./job";
import {
	createModel,
	deleteModel,
	discoverModels,
	findModel,
	listModels,
	updateModel,
} from "./model";
import {
	createOrganization,
	deleteOrganizations,
	findOrganization,
	listOrganizations,
	updateOrganization,
} from "./organization";
import {
	createOrganizationInvitations,
	deleteOrganizationInvitations,
	findOrganizationInvitation,
	listOrganizationInvitations,
	respondToOrganizationInvitation,
	updateOrganizationInvitation,
	validateOrganizationInvitation,
} from "./organization-invitation";
import {
	createOrganizationMember,
	deleteOrganizationMembers,
	findOrganizationMember,
	listOrganizationMembers,
	updateOrganizationMember,
} from "./organization-member";
import {
	createProvider,
	deleteProviders,
	findProvider,
	listProviders,
	updateProvider,
} from "./provider";
import {
	createQuotaPool,
	deactivateQuotaPool,
	findQuotaPool,
	listQuotaPools,
	quotaChatBadge,
	updateQuotaPool,
} from "./quota";
import {
	getResourceVisibility,
	grantResourceAccess,
	listResourceGrants,
	listResourcePrincipals,
	revokeResourceAccess,
	setResourceVisibility,
} from "./resource";
import {
	abortMultipartUpload,
	completeMultipartUpload,
	createDownloadUrl,
	createUploadUrls,
	finalizeUpload,
} from "./storage";
import {
	findUser,
	listUserAccess,
	listUsers,
	me,
	setActiveOrganization,
	setTourState,
	updatePassword,
} from "./user";

export const router = {
	bootstrap: {
		status: getBootstrapStatus,
		initialize: initializeBootstrap,
	},
	organization: {
		list: listOrganizations,
		create: createOrganization,
		find: findOrganization,
		update: updateOrganization,
		delete: deleteOrganizations,
	},
	organizationMember: {
		list: listOrganizationMembers,
		create: createOrganizationMember,
		find: findOrganizationMember,
		update: updateOrganizationMember,
		delete: deleteOrganizationMembers,
	},
	organizationInvitation: {
		list: listOrganizationInvitations,
		create: createOrganizationInvitations,
		find: findOrganizationInvitation,
		validate: validateOrganizationInvitation,
		update: updateOrganizationInvitation,
		delete: deleteOrganizationInvitations,
		respond: respondToOrganizationInvitation,
	},
	provider: {
		list: listProviders,
		create: createProvider,
		find: findProvider,
		update: updateProvider,
		delete: deleteProviders,
	},
	quota: {
		list: listQuotaPools,
		create: createQuotaPool,
		find: findQuotaPool,
		update: updateQuotaPool,
		deactivate: deactivateQuotaPool,
		chatBadge: quotaChatBadge,
	},
	resource: {
		listGrants: listResourceGrants,
		listPrincipals: listResourcePrincipals,
		grant: grantResourceAccess,
		revoke: revokeResourceAccess,
		getVisibility: getResourceVisibility,
		setVisibility: setResourceVisibility,
	},
	group: {
		list: listGroups,
		create: createGroup,
		find: findGroup,
		update: updateGroup,
		delete: deleteGroups,
		listMembers: listGroupMembers,
		addMembers: addGroupMembers,
		removeMembers: removeGroupMembers,
	},
	chat: {
		list: listChats,
		create: createChat,
		find: findChat,
		update: updateChat,
		delete: deleteChats,
	},
	chatBlock: {
		list: listChatBlocks,
		attach: attachChatBlock,
		detach: detachChatBlock,
	},
	chatMessage: {
		list: listChatMessages,
		create: createChatMessage,
		find: findChatMessage,
		update: updateChatMessage,
		delete: deleteChatMessages,
		rate: rateChatMessage,
		getBranch: getBranchIdForMessage,
	},
	block: {
		list: listBlocks,
		create: createBlock,
		find: findBlock,
		update: updateBlock,
		delete: deleteBlocks,
	},
	bot: {
		list: listBots,
		listDrafts: listDraftBots,
		find: findBot,
		findEditor: findBotEditor,
		save: saveBot,
		publish: publishBot,
		delete: deleteBots,
	},
	asset: {
		list: listAssets,
		save: saveAsset,
		saveMany: saveManyAssets,
		create: createAsset,
		find: findAsset,
		delete: deleteAssets,
	},
	assetPoint: {
		list: listAssetPoint,
	},
	user: {
		list: listUsers,
		find: findUser,
		listAccess: listUserAccess,
		me,
		updatePassword: updatePassword,
		setTourState: setTourState,
		setActiveOrganization: setActiveOrganization,
	},
	storage: {
		createUploadUrls: createUploadUrls,
		createDownloadUrl: createDownloadUrl,
		finalizeUpload: finalizeUpload,
		completeMultipartUpload: completeMultipartUpload,
		abortMultipartUpload: abortMultipartUpload,
	},
	model: {
		list: listModels,
		create: createModel,
		find: findModel,
		update: updateModel,
		delete: deleteModel,
		discover: discoverModels,
	},
	job: {
		list: listJobs,
		create: createJobs,
		retryProcessing: retryProcessing,
		retryVectorization: retryVectorization,
	},
	ai: {
		chat: aiChat,
	},
};
