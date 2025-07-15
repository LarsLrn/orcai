import type {
	InferContractRouterInputs,
	InferContractRouterOutputs,
} from "@orpc/contract";
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
	listAssetPointsContract,
	updateAssetPointContract,
} from "./asset-point";
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
	createInvitationsContract,
	deleteInvitationContract,
	findInvitationContract,
	listInvitationsContract,
	respondToInvitationContract,
	updateInvitationContract,
} from "./invitations";
import {
	createOrganizationContract,
	deleteOrganizationContract,
	findOrganizationContract,
	listOrganizationsContract,
	updateOrganizationContract,
} from "./organization";
import { createDownloadUrlContract, createUploadUrlsContract } from "./storage";
import { createDocumentTaskContract } from "./task";
import {
	findUserContract,
	listUsersContract,
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
	course: {
		list: listCoursesContract,
		find: findCourseContract,
		create: createCourseContract,
		update: updateCourseContract,
		delete: deleteCourseContract,
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
	},
	asset: {
		list: listAssetsContract,
		find: findAssetContract,
		create: createAssetContract,
		update: updateAssetContract,
		delete: deleteAssetContract,
	},
	assetPoints: {
		list: listAssetPointsContract,
		find: findAssetPointContract,
		create: createAssetPointContract,
		update: updateAssetPointContract,
		delete: deleteAssetPointContract,
	},
	user: {
		list: listUsersContract,
		find: findUserContract,
		updatePassword: updatePasswordContract,
	},
	invitation: {
		list: listInvitationsContract,
		create: createInvitationsContract,
		find: findInvitationContract,
		update: updateInvitationContract,
		delete: deleteInvitationContract,
		respond: respondToInvitationContract,
	},
	storage: {
		createUploadUrls: createUploadUrlsContract,
		createDownloadUrl: createDownloadUrlContract,
	},
	task: {
		createDocumentTask: createDocumentTaskContract,
	},
};

export type OrpcInputs = InferContractRouterInputs<typeof contracts>;
export type OrpcOutputs = InferContractRouterOutputs<typeof contracts>;
