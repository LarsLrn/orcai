import type {
	ActivityRunId,
	AssetId,
	BlockId,
	BotId,
	ChatId,
	ChatMessageId,
	DataExportId,
	GroupId,
	GroupMemberId,
	MemberId,
	ModelId,
	OrganizationId,
	OrganizationInvitationId,
	ProviderId,
	QuotaLedgerId,
	QuotaPeriodId,
	QuotaPoolAuditLogId,
	QuotaPoolGroupAssignmentId,
	QuotaPoolId,
	QuotaUsageEventId,
	UserId,
} from "@orcai/core";
import { createUuidIdSchema } from "./id-schema";

export const modelIdSchema = createUuidIdSchema<ModelId>();

export const chatIdSchema = createUuidIdSchema<ChatId>();

export const botIdSchema = createUuidIdSchema<BotId>();

export const assetIdSchema = createUuidIdSchema<AssetId>();

export const groupIdSchema = createUuidIdSchema<GroupId>();
export const groupMemberIdSchema = createUuidIdSchema<GroupMemberId>();

export const dataExportIdSchema = createUuidIdSchema<DataExportId>();

export const chatMessageIdSchema = createUuidIdSchema<ChatMessageId>();

export const providerIdSchema = createUuidIdSchema<ProviderId>();

export const userIdSchema = createUuidIdSchema<UserId>();

export const organizationIdSchema = createUuidIdSchema<OrganizationId>();
export const memberIdSchema = createUuidIdSchema<MemberId>();

export const blockIdSchema = createUuidIdSchema<BlockId>();

export const activityRunIdSchema = createUuidIdSchema<ActivityRunId>();

export const organizationInvitationIdSchema =
	createUuidIdSchema<OrganizationInvitationId>();

export const quotaPoolIdSchema = createUuidIdSchema<QuotaPoolId>();
export const quotaPoolGroupAssignmentIdSchema =
	createUuidIdSchema<QuotaPoolGroupAssignmentId>();
export const quotaPeriodIdSchema = createUuidIdSchema<QuotaPeriodId>();
export const quotaLedgerIdSchema = createUuidIdSchema<QuotaLedgerId>();
export const quotaUsageEventIdSchema = createUuidIdSchema<QuotaUsageEventId>();
export const quotaPoolAuditLogIdSchema =
	createUuidIdSchema<QuotaPoolAuditLogId>();
