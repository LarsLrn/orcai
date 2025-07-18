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
	createCourseInvitationsContract,
	deleteCourseInvitationsContract,
	findCourseInvitationContract,
	listCourseInvitationsContract,
	respondToCourseInvitationContract,
	updateCourseInvitationContract,
} from "./course-invitation";
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
import { createDownloadUrlContract, createUploadUrlsContract } from "./storage";
import { createDocumentTaskContract } from "./task";
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
		setActiveOrganization: setActiveOrganizationContract,
		setTourState: setTourStateContract,
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
