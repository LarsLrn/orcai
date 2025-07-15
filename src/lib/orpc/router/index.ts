import {
	createAsset,
	deleteAssets,
	findAsset,
	listAssets,
	updateAsset,
} from "./asset";
import { listAssetPoints } from "./asset-points";
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
	createInvitations,
	deleteInvitations,
	findInvitation,
	listInvitations,
	respondToInvitation,
	updateInvitation,
} from "./invitation";
import {
	createOrganization,
	deleteOrganizations,
	findOrganization,
	listOrganizations,
	updateOrganization,
} from "./organization";
import { sse } from "./sse";
import { createDownloadUrl, createUploadUrls } from "./storage";
import { createDocumentTask } from "./task";
import { findUser, listUsers, updatePassword } from "./user";

export const router = {
	organization: {
		list: listOrganizations,
		create: createOrganization,
		find: findOrganization,
		update: updateOrganization,
		delete: deleteOrganizations,
	},
	course: {
		list: listCourses,
		create: createCourse,
		find: findCourse,
		update: updateCourse,
		delete: deleteCourses,
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
	},
	asset: {
		list: listAssets,
		create: createAsset,
		find: findAsset,
		update: updateAsset,
		delete: deleteAssets,
	},
	assetPoints: {
		list: listAssetPoints,
	},
	user: {
		list: listUsers,
		find: findUser,
		updatePassword: updatePassword,
	},
	invitation: {
		list: listInvitations,
		create: createInvitations,
		find: findInvitation,
		update: updateInvitation,
		delete: deleteInvitations,
		respond: respondToInvitation,
	},
	storage: {
		createUploadUrls: createUploadUrls,
		createDownloadUrl: createDownloadUrl,
	},
	task: {
		createDocumentTask: createDocumentTask,
	},
	sse,
};
