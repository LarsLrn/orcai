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
	saveAssetContract,
	saveManyAssetsContract,
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
	attachCourseBotContract,
	createCourseContract,
	deleteCourseContract,
	detachCourseBotContract,
	findCourseContract,
	listCourseBotsContract,
	listCoursesContract,
	updateCourseContract,
} from "./course";
import {
	addGroupMembersContract,
	createGroupContract,
	deleteGroupContract,
	findGroupContract,
	listGroupMembersContract,
	listGroupsContract,
	removeGroupMembersContract,
	updateGroupContract,
} from "./group";
import {
	createJobsContract,
	listJobsContract,
	retryProcessingContract,
	retryVectorizationContract,
} from "./job";
import {
	createModelContract,
	deleteModelContract,
	discoverModelsContract,
	findModelContract,
	listModelsContract,
	updateModelContract,
} from "./model";
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
	validateOrganizationInvitationContract,
} from "./organization-invitation";
import {
	createOrganizationMemberContract,
	deleteOrganizationMemberContract,
	findOrganizationMemberContract,
	listOrganizationMembersContract,
	updateOrganizationMemberContract,
} from "./organization-member";
import {
	createProviderContract,
	deleteProviderContract,
	findProviderContract,
	listProvidersContract,
	updateProviderContract,
} from "./provider";
import {
	getResourceVisibilityContract,
	grantResourceAccessContract,
	listResourceGrantsContract,
	listResourcePrincipalsContract,
	revokeResourceAccessContract,
	setResourceVisibilityContract,
} from "./resource";
import {
	abortMultipartUploadContract,
	completeMultipartUploadContract,
	createDownloadUrlContract,
	createUploadUrlsContract,
	finalizeUploadContract,
} from "./storage";
import {
	findUserContract,
	listUserAccessContract,
	listUsersContract,
	meContract,
	setActiveOrganizationContract,
	setTourStateContract,
	updatePasswordContract,
} from "./user";

export const contracts = {
	bootstrap: {
		status: bootstrapStatusContract,
		initialize: bootstrapInitializeContract,
	},
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
		validate: validateOrganizationInvitationContract,
		update: updateOrganizationInvitationContract,
		delete: deleteOrganizationInvitationsContract,
		respond: respondToOrganizationInvitationContract,
	},
	provider: {
		list: listProvidersContract,
		create: createProviderContract,
		find: findProviderContract,
		update: updateProviderContract,
		delete: deleteProviderContract,
	},
	resource: {
		listGrants: listResourceGrantsContract,
		listPrincipals: listResourcePrincipalsContract,
		grant: grantResourceAccessContract,
		revoke: revokeResourceAccessContract,
		getVisibility: getResourceVisibilityContract,
		setVisibility: setResourceVisibilityContract,
	},
	course: {
		list: listCoursesContract,
		find: findCourseContract,
		create: createCourseContract,
		update: updateCourseContract,
		delete: deleteCourseContract,
		listBots: listCourseBotsContract,
		attachBot: attachCourseBotContract,
		detachBot: detachCourseBotContract,
	},
	group: {
		list: listGroupsContract,
		create: createGroupContract,
		find: findGroupContract,
		update: updateGroupContract,
		delete: deleteGroupContract,
		listMembers: listGroupMembersContract,
		addMembers: addGroupMembersContract,
		removeMembers: removeGroupMembersContract,
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
		listDrafts: listDraftBotsContract,
		find: findBotContract,
		findEditor: findBotEditorContract,
		save: saveBotContract,
		publish: publishBotContract,
		delete: deleteBotContract,
	},
	asset: {
		list: listAssetsContract,
		find: findAssetContract,
		save: saveAssetContract,
		saveMany: saveManyAssetsContract,
		create: createAssetContract,
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
		listAccess: listUserAccessContract,
		me: meContract,
		updatePassword: updatePasswordContract,
		setActiveOrganization: setActiveOrganizationContract,
		setTourState: setTourStateContract,
	},
	model: {
		list: listModelsContract,
		create: createModelContract,
		find: findModelContract,
		update: updateModelContract,
		delete: deleteModelContract,
		discover: discoverModelsContract,
	},
	storage: {
		createUploadUrls: createUploadUrlsContract,
		createDownloadUrl: createDownloadUrlContract,
		finalizeUpload: finalizeUploadContract,
		completeMultipartUpload: completeMultipartUploadContract,
		abortMultipartUpload: abortMultipartUploadContract,
	},
	job: {
		list: listJobsContract,
		create: createJobsContract,
		retryProcessing: retryProcessingContract,
		retryVectorization: retryVectorizationContract,
	},
	ai: {
		chat: aiChatContract,
	},
};

export type OrpcInputs = InferContractRouterInputs<typeof contracts>;
export type OrpcOutputs = InferContractRouterOutputs<typeof contracts>;
