declare const brandSymbol: unique symbol;

export type Brand<TValue, TBrand extends string> = TValue & {
	readonly [brandSymbol]: TBrand;
};

type UuidBrand<TBrand extends string> = Brand<string, TBrand>;

export type UserId = UuidBrand<"UserId">;
export type AssetId = UuidBrand<"AssetId">;
export type OrganizationId = UuidBrand<"OrganizationId">;
export type MemberId = UuidBrand<"MemberId">;
export type OrganizationInvitationId = UuidBrand<"OrganizationInvitationId">;
export type ProviderId = UuidBrand<"ProviderId">;
export type ModelId = UuidBrand<"ModelId">;
export type BlockId = UuidBrand<"BlockId">;
export type BotId = UuidBrand<"BotId">;
export type ChatId = UuidBrand<"ChatId">;
export type ChatBranchId = UuidBrand<"ChatBranchId">;
export type ChatMessageId = UuidBrand<"ChatMessageId">;
export type GroupId = UuidBrand<"GroupId">;
export type GroupMemberId = UuidBrand<"GroupMemberId">;
export type QuotaPoolId = UuidBrand<"QuotaPoolId">;
export type QuotaPoolGroupAssignmentId =
	UuidBrand<"QuotaPoolGroupAssignmentId">;
export type QuotaPeriodId = UuidBrand<"QuotaPeriodId">;
export type QuotaLedgerId = UuidBrand<"QuotaLedgerId">;
export type QuotaUsageEventId = UuidBrand<"QuotaUsageEventId">;
export type QuotaPoolAuditLogId = UuidBrand<"QuotaPoolAuditLogId">;
