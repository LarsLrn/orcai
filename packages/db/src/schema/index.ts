import { asset } from "./asset";
import {
	account,
	passkey,
	session,
	twoFactor,
	user,
	verification,
} from "./auth";
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
import { bot, botBlock, botFavourite } from "./bot";
import { chat, chatKindEnum } from "./chat";
import {
	chatMessage,
	chatMessageRating,
	chatMessageRatingEnum,
} from "./chat-message";
import { dataExport, dataExportStatusEnum } from "./data-export";
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
	twoFactor,
	passkey,
	authzOutbox,
	asset,
	block,
	chatBlock,
	blockAsset,
	bot,
	botBlock,
	botFavourite,
	chatMessage,
	chatMessageRating,
	chat,
	dataExport,
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
	chatKindEnum,
	chatMessageRatingEnum,
	dataExportStatusEnum,
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
