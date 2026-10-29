import { z } from "zod/v4";
import type { FeatureId } from "../feature/schema";

/** Stable codes the client translates; the server never sends user-facing prose. */
export const ERROR_REASONS = [
	"ACTIVE_ORGANIZATION_REQUIRED",
	"AI_PROMPT_REQUIRED",
	"AI_STREAM_FAILED",
	"AI_TOOL_FAILED",
	"ALREADY_EXISTS",
	"ASSET_LINK_FORBIDDEN",
	"ASSET_NOT_ATTACHED",
	"ASSET_NOT_FOUND",
	"ASSISTANT_CONVERSATION_IMMUTABLE",
	"ASSISTANT_MODEL_NOT_CONFIGURED",
	"AUTH_REQUIRED",
	"BEHAVIOUR_BLOCK_TYPE_INVALID",
	"BLOCK_IN_USE_BY_READY_BOTS",
	"BLOCK_LINK_FORBIDDEN",
	"BLOCK_NOT_FOUND",
	"BOOTSTRAP_USER_CREATE_FAILED",
	"BOT_BEHAVIOUR_BLOCK_NOT_READY",
	"BOT_BEHAVIOUR_BLOCK_REQUIRED",
	"BOT_MODEL_UNAVAILABLE",
	"BOT_NOT_FOUND",
	"BOT_NOT_PUBLISHED",
	"BOT_REPOSITORY_EMPTY",
	"BOT_REPOSITORY_NOT_READY",
	"BOT_SETUP_FORBIDDEN",
	"CHAT_BLOCKS_UNAVAILABLE",
	"CHAT_BOT_BLOCKS_IMMUTABLE",
	"CHAT_BOT_DELETED",
	"CHAT_BOT_FEATURES_IMMUTABLE",
	"CHAT_BOT_UNAVAILABLE",
	"CHAT_CONTEXT_TOO_LONG",
	"CHAT_MAX_TOKENS_EXCEEDS_MODEL",
	"CHAT_MESSAGE_CREATE_FAILED",
	"CHAT_MESSAGE_ID_TAKEN",
	"CHAT_MESSAGE_NOT_FOUND",
	"CHAT_MODEL_NOT_CONFIGURED",
	"CHAT_MODEL_REQUIRED_BY_BOT",
	"CHAT_NOT_FOUND",
	"CHAT_ORGANIZATION_MISMATCH",
	"CHAT_RATING_FAILED",
	"CHAT_TEMPLATE_BLOCK_ALREADY_ATTACHED",
	"CHAT_TOOL_OUTPUT_INVALID",
	"CHAT_TURN_DECISIONS_INCOMPLETE",
	"CHAT_TURN_NOT_AWAITING",
	"CURRENT_PASSWORD_INCORRECT",
	"DATA_EXPORT_IN_PROGRESS",
	"DEFAULT_REFERENCES_OUT_OF_RANGE",
	"DOCUMENT_STILL_PREPARING",
	"EMAIL_ALREADY_REGISTERED",
	"EMAIL_NOT_VERIFIED",
	"ENTITY_IDS_REQUIRED",
	"FEATURE_REQUIREMENT_MISSING",
	"GRANT_PRINCIPALS_INVALID",
	"GROUP_MEMBERS_INVALID",
	"GROUP_NOT_FOUND",
	"INSTANCE_ADMIN_REQUIRED",
	"INSTANCE_ALREADY_INITIALISED",
	"INSTANCE_ROLE_INVALID",
	"INVALID_CREDENTIALS",
	"INVALID_TOOL_INPUT",
	"INVITATION_ALREADY_ACCEPTED",
	"INVITEE_ALREADY_MEMBER",
	"INVITATION_CHANGED",
	"INVITATION_EXPIRED",
	"INVITATION_NOT_FOUND",
	"INVITATION_REQUIRED",
	"INVITATION_RESPONSE_FORBIDDEN",
	"INVITATION_RESPONSE_INVALID",
	"ITEMS_NOT_UNIQUE",
	"LAST_MANAGER_REQUIRED",
	"LAST_ORGANIZATION_ADMIN_REQUIRED",
	"MEMBER_NOT_FOUND",
	"METADATA_GENERATION_UNAVAILABLE",
	"MODEL_DEPRECATED",
	"MODEL_NOT_FOUND",
	"MODEL_PROVIDER_MISMATCH",
	"MODEL_TEXT_UNSUPPORTED",
	"MODEL_TOOLS_UNSUPPORTED",
	"MUTABLE_FIELD_REQUIRED",
	"ORGANIZATION_ADMIN_REQUIRED",
	"ORGANIZATION_MEMBERSHIP_REVOKED",
	"ORGANIZATION_NOT_FOUND",
	"PASSWORD_NOT_SET",
	"PASSKEY_ALREADY_REGISTERED",
	"PASSKEY_CANCELLED",
	"PASSKEY_SIGN_IN_FAILED",
	"PASSKEY_USER_NOT_VERIFIED",
	"PASSWORDS_MISMATCH",
	"PERMISSION_DENIED",
	"PRIVACY_CONSENT_REQUIRED",
	"PROFILE_IMAGE_UPLOAD_REQUIRED",
	"PROVIDER_COST_REPORTING_NOT_ALLOWED",
	"PROVIDER_CURRENCY_NOT_ALLOWED",
	"PROVIDER_DISABLED",
	"PROVIDER_ENDPOINT_NOT_ALLOWED",
	"PROVIDER_ENDPOINT_REQUIRED",
	"PROVIDER_METERING_MODE_NOT_ALLOWED",
	"PROVIDER_MODELS_FETCH_FAILED",
	"PROVIDER_NOT_FOUND",
	"PROVIDER_PURPOSE_MISMATCH",
	"PROVIDER_SEARCH_PRICE_NOT_ALLOWED",
	"QUOTA_CHECK_FAILED",
	"QUOTA_EXHAUSTED",
	"QUOTA_GROUPS_INVALID",
	"QUOTA_POOL_NOT_FOUND",
	"QUOTA_POOL_UNAVAILABLE",
	"REFERENCE_RANGE_INVALID",
	"REPOSITORY_BLOCK_TYPE_INVALID",
	"REPOSITORY_NOT_FOUND",
	"REQUEST_HEADERS_REQUIRED",
	"RESOURCE_NOT_USABLE_IN_ORGANIZATION",
	"RESOURCE_SCOPE_REQUIRED",
	"SELF_BAN_FORBIDDEN",
	"SELF_DELETE_FORBIDDEN",
	"SELF_INSTANCE_ROLE_CHANGE_FORBIDDEN",
	"SELF_TWO_FACTOR_RESET_FORBIDDEN",
	"SESSION_NOT_FOUND",
	"SESSION_NOT_FRESH",
	"SORT_KEY_UNSUPPORTED",
	"SYSTEM_GROUP_IMMUTABLE",
	"TOKEN_INVALID",
	"TOOL_NOT_AVAILABLE",
	"TWO_FACTOR_CHALLENGE_EXPIRED",
	"TWO_FACTOR_CODE_INVALID",
	"TWO_FACTOR_LOCKED",
	"TWO_FACTOR_REQUIRED",
	"UPLOAD_CREATE_FAILED",
	"UPLOAD_FILE_MISSING",
	"UPLOAD_FILE_SIZE_MISMATCH",
	"UPLOAD_FILE_TOO_LARGE",
	"UPLOAD_FILE_TYPE_INVALID",
	"UPLOAD_INIT_FAILED",
	"UPLOAD_REQUEST_INVALID",
	"UPLOAD_TOO_MANY_FILES",
	"USER_BANNED",
	"USER_NOT_FOUND",
	"USER_NOT_MEMBER",
	"USER_OWNS_CONTENT",
	"USER_PREFERENCES_NOT_FOUND",
	"USER_UNBAN_FAILED",
	"WEB_SEARCH_FAILED",
] as const;

export const errorReasonSchema = z.enum(ERROR_REASONS);

export type ErrorReason = z.infer<typeof errorReasonSchema>;

export const GRANT_REJECTION_REASONS = [
	"ALL_MEMBERS_VIEWER_ONLY",
	"GROUP_NOT_IN_SCOPE",
	"GROUP_NOT_JOINED",
	"USER_NOT_IN_SCOPE",
] as const;

export type GrantRejectionReason = (typeof GRANT_REJECTION_REASONS)[number];

export type GrantRejection = {
	principalId: string;
	reason: GrantRejectionReason;
};

/** Reasons that carry data for their message. User data stays raw; vocabulary is typed. */
export type ErrorReasonParams = {
	BLOCK_IN_USE_BY_READY_BOTS: {
		botNames: string[];
	};
	BOT_REPOSITORY_EMPTY: {
		blockName: string;
	};
	BOT_REPOSITORY_NOT_READY: {
		blockName: string;
	};
	CHAT_MAX_TOKENS_EXCEEDS_MODEL: {
		maxOutputTokens: number;
	};
	FEATURE_REQUIREMENT_MISSING: {
		feature: FeatureId;
		requirement: FeatureId;
	};
	GRANT_PRINCIPALS_INVALID: {
		rejections: GrantRejection[];
	};
	GROUP_MEMBERS_INVALID: {
		userIds: string[];
	};
	INVITEE_ALREADY_MEMBER: {
		emails: string[];
	};
	SORT_KEY_UNSUPPORTED: {
		sortKey: string;
	};
	UPLOAD_FILE_TOO_LARGE: {
		fileName: string;
	};
	UPLOAD_FILE_TYPE_INVALID: {
		fileName: string;
		fileType: string;
	};
	UPLOAD_TOO_MANY_FILES: {
		maxFiles: number;
	};
};

export type ErrorReasonWithParams = keyof ErrorReasonParams;

export type AnyErrorParams = ErrorReasonParams[ErrorReasonWithParams];

export type ErrorParamsOf<R extends ErrorReason> =
	R extends ErrorReasonWithParams ? ErrorReasonParams[R] : undefined;

/** Discriminated union linking every reason to its params. */
export type ErrorReasonProps = {
	[R in ErrorReason]: R extends ErrorReasonWithParams
		? {
				readonly reason: R;
				readonly params: ErrorReasonParams[R];
			}
		: {
				readonly reason: R;
				readonly params?: undefined;
			};
}[ErrorReason];

/** Fallback vocabulary for NOT_FOUND errors raised without a reason. */
export const NOT_FOUND_ENTITIES = [
	"asset",
	"block",
	"bot",
	"chat",
	"chatMessage",
	"group",
	"invitation",
	"member",
	"model",
	"organization",
	"provider",
	"quotaPool",
	"repository",
	"user",
] as const;

export const notFoundEntitySchema = z.enum(NOT_FOUND_ENTITIES);

export type NotFoundEntity = z.infer<typeof notFoundEntitySchema>;

export type ErrorData = {
	reason?: ErrorReason;
	params?: Record<string, unknown>;
};

export type NotFoundErrorData = ErrorData & {
	entity?: NotFoundEntity;
};

export type ForbiddenErrorData = ErrorData & {
	allowed: false;
	permission?: string;
	entityType?: string;
	zedToken?: string;
};

// Annotated so the contract types stay small; the inferred object type would
// be repeated on every procedure.
export const errorDataSchema: z.ZodType<ErrorData> = z.object({
	reason: errorReasonSchema.optional(),
	params: z.record(z.string(), z.unknown()).optional(),
});

export const notFoundErrorDataSchema: z.ZodType<NotFoundErrorData> = z.object({
	reason: errorReasonSchema.optional(),
	params: z.record(z.string(), z.unknown()).optional(),
	entity: notFoundEntitySchema.optional(),
});

export const forbiddenErrorDataSchema: z.ZodType<ForbiddenErrorData> = z.object(
	{
		reason: errorReasonSchema.optional(),
		params: z.record(z.string(), z.unknown()).optional(),
		allowed: z.literal(false),
		permission: z.string().optional(),
		entityType: z.string().optional(),
		zedToken: z.string().optional(),
	},
);
