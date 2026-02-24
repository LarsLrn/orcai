import { aiChat } from "./ai";
import {
	createAsset,
	deleteAssets,
	findAsset,
	listAssets,
	updateAsset,
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
import { createBot, deleteBots, findBot, listBots, updateBot } from "./bot";
import {
	createChat,
	deleteChats,
	findChat,
	listChats,
	updateChat,
} from "./chat";
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
	createCourse,
	deleteCourses,
	findCourse,
	listCourses,
	updateCourse,
} from "./course";
import {
	createCourseInvitations,
	deleteCourseInvitations,
	findCourseInvitation,
	listCourseInvitations,
	respondToCourseInvitation,
	updateCourseInvitation,
} from "./course-invitation";
import { createJobs, listJobs } from "./job";
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
	respondToOrganisationInvitation,
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
import { sse } from "./sse";
import {
	abortMultipartUpload,
	completeMultipartUpload,
	createDownloadUrl,
	createUploadUrls,
	finalizeUpload,
} from "./storage";
import {
	findUser,
	listUsers,
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
		respond: respondToOrganisationInvitation,
	},
	provider: {
		list: listProviders,
		create: createProvider,
		find: findProvider,
		update: updateProvider,
		delete: deleteProviders,
	},
	course: {
		list: listCourses,
		create: createCourse,
		find: findCourse,
		update: updateCourse,
		delete: deleteCourses,
	},
	courseInvitation: {
		list: listCourseInvitations,
		create: createCourseInvitations,
		find: findCourseInvitation,
		update: updateCourseInvitation,
		delete: deleteCourseInvitations,
		respond: respondToCourseInvitation,
	},
	chat: {
		list: listChats,
		create: createChat,
		find: findChat,
		update: updateChat,
		delete: deleteChats,
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
		create: createBot,
		find: findBot,
		update: updateBot,
		delete: deleteBots,
	},
	asset: {
		list: listAssets,
		create: createAsset,
		find: findAsset,
		update: updateAsset,
		delete: deleteAssets,
	},
	assetPoint: {
		list: listAssetPoint,
	},
	user: {
		list: listUsers,
		find: findUser,
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
	},
	ai: {
		chat: aiChat,
	},
	sse,
};
