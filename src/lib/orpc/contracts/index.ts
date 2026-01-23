import type {
	InferContractRouterInputs,
	InferContractRouterOutputs,
} from "@orpc/contract";
import { aiChatContract } from "./ai";
import {
	createAssetContract,
	deleteAssetContract,
	findAssetContract,
	listAssetsContract,
	updateAssetContract,
} from "./asset";
import {
	createAssetPointContract,
	deleteAssetPointContract,
	findAssetPointContract,
	listAssetPointContract,
	updateAssetPointContract,
} from "./asset-point";
import {
	createBlockContract,
	deleteBlockContract,
	findBlockContract,
	listBlocksContract,
	updateBlockContract,
} from "./block";
import {
	createBotContract,
	deleteBotContract,
	findBotContract,
	listBotsContract,
	updateBotContract,
} from "./bot";
import {
	createChatContract,
	deleteChatContract,
	findChatContract,
	listChatsContract,
	updateChatContract,
} from "./chat";
import {
	createChatMessageContract,
	deleteChatMessageContract,
	findChatMessageContract,
	getBranchIdForMessageContract,
	listChatMessagesContract,
	rateChatMessageContract,
	updateChatMessageContract,
} from "./chat-message";
import {
	createCourseContract,
	deleteCourseContract,
	findCourseContract,
	listCoursesContract,
	updateCourseContract,
} from "./course";
import {
	createCourseInvitationsContract,
	deleteCourseInvitationsContract,
	findCourseInvitationContract,
	listCourseInvitationsContract,
	respondToCourseInvitationContract,
	updateCourseInvitationContract,
} from "./course-invitation";
import { createJobsContract, listJobsContract } from "./job";
import { findModelContract, listModelsContract } from "./model";
import {
	createOrganizationContract,
	deleteOrganizationContract,
	findOrganizationContract,
	listOrganizationsContract,
	updateOrganizationContract,
} from "./organization";
import {
	createOrganizationInvitationsContract,
	deleteOrganizationInvitationsContract,
	findOrganizationInvitationContract,
	listOrganizationInvitationsContract,
	respondToOrganizationInvitationContract,
	updateOrganizationInvitationContract,
} from "./organization-invitation";
import {
	createOrganizationMemberContract,
	deleteOrganizationMemberContract,
	findOrganizationMemberContract,
	listOrganizationMembersContract,
	updateOrganizationMemberContract,
} from "./organization-member";
import {
	createOrganizationProviderContract,
	deleteOrganizationProviderContract,
	findOrganizationProviderContract,
	listOrganizationProvidersContract,
	updateOrganizationProviderContract,
} from "./organization-provider";
import { findProviderContract, listProvidersContract } from "./provider";
import { createDownloadUrlContract, createUploadUrlsContract } from "./storage";
import {
	findUserContract,
	listUsersContract,
	setActiveOrganizationContract,
	setTourStateContract,
	updatePasswordContract,
} from "./user";

export const contracts = {
	organization: {
		list: listOrganizationsContract,
		find: findOrganizationContract,
		create: createOrganizationContract,
		update: updateOrganizationContract,
		delete: deleteOrganizationContract,
	},
	organizationMember: {
		list: listOrganizationMembersContract,
		find: findOrganizationMemberContract,
		create: createOrganizationMemberContract,
		update: updateOrganizationMemberContract,
		delete: deleteOrganizationMemberContract,
	},
	organizationInvitation: {
		list: listOrganizationInvitationsContract,
		create: createOrganizationInvitationsContract,
		find: findOrganizationInvitationContract,
		update: updateOrganizationInvitationContract,
		delete: deleteOrganizationInvitationsContract,
		respond: respondToOrganizationInvitationContract,
	},
	organizationProvider: {
		list: listOrganizationProvidersContract,
		create: createOrganizationProviderContract,
		find: findOrganizationProviderContract,
		update: updateOrganizationProviderContract,
		delete: deleteOrganizationProviderContract,
	},
	course: {
		list: listCoursesContract,
		find: findCourseContract,
		create: createCourseContract,
		update: updateCourseContract,
		delete: deleteCourseContract,
	},
	courseInvitation: {
		list: listCourseInvitationsContract,
		create: createCourseInvitationsContract,
		find: findCourseInvitationContract,
		update: updateCourseInvitationContract,
		delete: deleteCourseInvitationsContract,
		respond: respondToCourseInvitationContract,
	},
	chat: {
		list: listChatsContract,
		find: findChatContract,
		create: createChatContract,
		update: updateChatContract,
		delete: deleteChatContract,
	},
	chatMessage: {
		list: listChatMessagesContract,
		find: findChatMessageContract,
		create: createChatMessageContract,
		update: updateChatMessageContract,
		delete: deleteChatMessageContract,
		rate: rateChatMessageContract,
		getBranch: getBranchIdForMessageContract,
	},
	block: {
		list: listBlocksContract,
		find: findBlockContract,
		create: createBlockContract,
		update: updateBlockContract,
		delete: deleteBlockContract,
	},
	bot: {
		list: listBotsContract,
		find: findBotContract,
		create: createBotContract,
		update: updateBotContract,
		delete: deleteBotContract,
	},
	asset: {
		list: listAssetsContract,
		find: findAssetContract,
		create: createAssetContract,
		update: updateAssetContract,
		delete: deleteAssetContract,
	},
	assetPoint: {
		list: listAssetPointContract,
		find: findAssetPointContract,
		create: createAssetPointContract,
		update: updateAssetPointContract,
		delete: deleteAssetPointContract,
	},
	user: {
		list: listUsersContract,
		find: findUserContract,
		updatePassword: updatePasswordContract,
		setActiveOrganization: setActiveOrganizationContract,
		setTourState: setTourStateContract,
	},
	provider: {
		list: listProvidersContract,
		find: findProviderContract,
	},
	model: {
		list: listModelsContract,
		find: findModelContract,
	},
	storage: {
		createUploadUrls: createUploadUrlsContract,
		createDownloadUrl: createDownloadUrlContract,
	},
	job: {
		list: listJobsContract,
		create: createJobsContract,
	},
	ai: {
		chat: aiChatContract,
	},
};

export type OrpcInputs = InferContractRouterInputs<typeof contracts>;
export type OrpcOutputs = InferContractRouterOutputs<typeof contracts>;
