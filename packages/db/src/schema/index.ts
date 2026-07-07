import { asset } from "./asset";
import { account, session, user, verification } from "./auth";
import {
	authzOutbox,
	authzOutboxStatusEnum,
	group,
	groupKindEnum,
	groupMember,
	groupSystemKeyEnum,
	principalTypeEnum,
	resourceGrant,
	resourceGrantRoleEnum,
	resourceScope,
	resourceTypeEnum,
	resourceVisibility,
	resourceVisibilityEnum,
} from "./authz";
import { block, blockAsset, chatBlock } from "./block";
import { bot, botBlock } from "./bot";
import { chat } from "./chat";
import { chatBranch } from "./chat-branch";
import { chatMessage } from "./chat-message";
import { model, provider, providerMeteringModeEnum } from "./model";
import {
	notificationOutbox,
	notificationOutboxStatusEnum,
} from "./notification";
import { invitation, member, organization } from "./organization";
import {
	quotaLedger,
	quotaPeriod,
	quotaPeriodStatusEnum,
	quotaPool,
	quotaPoolAuditLog,
	quotaPoolGroupAssignment,
	quotaPoolPeriodTypeEnum,
	quotaUsageEvent,
	quotaUsageEventTypeEnum,
} from "./quota";

export const dbSchema = {
	user,
	session,
	account,
	verification,
	authzOutbox,
	asset,
	block,
	chatBlock,
	blockAsset,
	bot,
	botBlock,
	chatBranch,
	chatMessage,
	chat,
	group,
	groupMember,
	model,
	provider,
	notificationOutbox,
	quotaPool,
	quotaPoolGroupAssignment,
	quotaPeriod,
	quotaLedger,
	quotaUsageEvent,
	quotaPoolAuditLog,
	organization,
	member,
	invitation,
	resourceGrant,
	resourceScope,
	resourceVisibility,
};

export const enumSchema = {
	authzOutboxStatusEnum,
	groupKindEnum,
	groupSystemKeyEnum,
	principalTypeEnum,
	resourceGrantRoleEnum,
	resourceTypeEnum,
	resourceVisibilityEnum,
	providerMeteringModeEnum,
	notificationOutboxStatusEnum,
	quotaPoolPeriodTypeEnum,
	quotaPeriodStatusEnum,
	quotaUsageEventTypeEnum,
};
