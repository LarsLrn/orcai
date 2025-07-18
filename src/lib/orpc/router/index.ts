import { aiChat, testChat } from "./ai";
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
	createCourseInvitations,
	deleteCourseInvitations,
	findCourseInvitation,
	listCourseInvitations,
	respondToCourseInvitation,
	updateCourseInvitation,
} from "./course-invitation";
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
	updateOrganizationInvitation,
} from "./organization-invitation";
import {
	createOrganizationMember,
	deleteOrganizationMembers,
	findOrganizationMember,
	listOrganizationMembers,
	updateOrganizationMember,
} from "./organization-member";
import { sse } from "./sse";
import { createDownloadUrl, createUploadUrls } from "./storage";
import { createDocumentTask } from "./task";
import {
	findUser,
	listUsers,
	setActiveOrganization,
	setTourState,
	updatePassword,
} from "./user";

export const router = {
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
		update: updateOrganizationInvitation,
		delete: deleteOrganizationInvitations,
		respond: findOrganizationInvitation,
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
		setTourState: setTourState,
		setActiveOrganization: setActiveOrganization,
	},
	storage: {
		createUploadUrls: createUploadUrls,
		createDownloadUrl: createDownloadUrl,
	},
	task: {
		createDocumentTask: createDocumentTask,
	},
	ai: {
		chat: aiChat,
		testChat: testChat,
	},
	sse,
};
