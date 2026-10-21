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
	"ASSET_SOURCE_REQUIRED",
	"ASSET_UPLOAD_REQUIRED",
	"ASSISTANT_CONVERSATION_IMMUTABLE",
	"ASSISTANT_MODEL_NOT_CONFIGURED",
	"ASSISTANT_ORGANIZATION_MISMATCH",
	"AUTH_REQUIRED",
	"BEHAVIOUR_BLOCK_TYPE_INVALID",
	"BLOCK_IN_USE_BY_READY_BOTS",
	"BLOCK_LINK_FORBIDDEN",
	"BLOCK_NOT_FOUND",
	"BOOTSTRAP_USER_CREATE_FAILED",
	"BOT_BEHAVIOUR_BLOCK_NOT_READY",
	"BOT_BEHAVIOUR_BLOCK_REQUIRED",
	"BOT_NOT_FOUND",
	"BOT_REPOSITORY_EMPTY",
	"BOT_REPOSITORY_NOT_READY",
	"CHAT_BLOCKS_UNAVAILABLE",
	"CHAT_BOT_BLOCKS_IMMUTABLE",
	"CHAT_BOT_FEATURES_IMMUTABLE",
	"CHAT_MESSAGE_CREATE_FAILED",
	"CHAT_MESSAGE_ID_TAKEN",
	"CHAT_MESSAGE_NOT_FOUND",
	"CHAT_MODEL_NOT_CONFIGURED",
	"CHAT_NOT_FOUND",
	"CHAT_RATING_FAILED",
	"CHAT_TEMPLATE_BLOCK_ALREADY_ATTACHED",
	"CHAT_TOOL_OUTPUT_INVALID",
	"CHAT_TURN_DECISIONS_INCOMPLETE",
	"CHAT_TURN_NOT_AWAITING",
	"CURRENT_PASSWORD_INCORRECT",
	"DEFAULT_REFERENCES_OUT_OF_RANGE",
	"EMAIL_ALREADY_REGISTERED",
	"EMAIL_NOT_VERIFIED",
	"ENTITY_IDS_REQUIRED",
	"FEATURE_REQUIREMENT_MISSING",
	"GRANT_NOT_RECORDED",
	"GRANT_PRINCIPALS_INVALID",
	"GROUP_MEMBERS_INVALID",
	"GROUP_NOT_FOUND",
	"INSTANCE_ADMIN_REQUIRED",
	"INSTANCE_ALREADY_INITIALISED",
	"INSTANCE_ROLE_INVALID",
	"INVALID_CREDENTIALS",
	"INVALID_TOOL_INPUT",
	"INVITATION_ALREADY_ACCEPTED",
	"INVITATION_CHANGED",
	"INVITATION_EXPIRED",
	"INVITATION_NOT_FOUND",
	"INVITATION_REQUIRED",
	"INVITATION_RESPONSE_FORBIDDEN",
	"INVITATION_RESPONSE_INVALID",
	"ITEMS_NOT_UNIQUE",
	"JOB_RUNNER_UNSUPPORTED",
	"LAST_MANAGER_REQUIRED",
	"LAST_ORGANIZATION_ADMIN_REQUIRED",
	"MEMBER_NOT_FOUND",
	"MODEL_DEPRECATED",
	"MODEL_NOT_FOUND",
	"MODEL_PROVIDER_MISMATCH",
	"MODEL_TOOLS_UNSUPPORTED",
	"MUTABLE_FIELD_REQUIRED",
	"ORGANIZATION_ADMIN_REQUIRED",
	"ORGANIZATION_MEMBERSHIP_REVOKED",
	"ORGANIZATION_NOT_FOUND",
	"PASSWORD_NOT_SET",
	"PASSWORDS_MISMATCH",
	"PERMISSION_DENIED",
	"PRIVACY_CONSENT_REQUIRED",
	"PROVIDER_DISABLED",
	"PROVIDER_ENDPOINT_NOT_ALLOWED",
	"PROVIDER_ENDPOINT_REQUIRED",
	"PROVIDER_MODELS_FETCH_FAILED",
	"PROVIDER_NOT_FOUND",
	"QUOTA_CHECK_FAILED",
	"QUOTA_EXHAUSTED",
	"QUOTA_GROUPS_INVALID",
	"QUOTA_POOL_NOT_FOUND",
	"QUOTA_POOL_UNAVAILABLE",
	"REFERENCE_RANGE_INVALID",
	"REPOSITORY_BLOCK_TYPE_INVALID",
	"REPOSITORY_NOT_FOUND",
	"REQUEST_HEADERS_REQUIRED",
	"RESOURCE_SCOPE_REQUIRED",
	"SELF_BAN_FORBIDDEN",
	"SELF_DELETE_FORBIDDEN",
	"SESSION_NOT_FOUND",
	"SORT_KEY_UNSUPPORTED",
	"SYSTEM_GROUP_IMMUTABLE",
	"TOKEN_INVALID",
	"TOOL_NOT_AVAILABLE",
	"UPLOAD_FILE_MISSING",
	"UPLOAD_FILE_SIZE_MISMATCH",
	"UPLOAD_FILE_TOO_LARGE",
	"UPLOAD_FILE_TYPE_INVALID",
	"UPLOAD_INIT_FAILED",
	"UPLOAD_REQUEST_INVALID",
	"UPLOAD_TOO_MANY_FILES",
	"USER_BAN_FAILED",
	"USER_BANNED",
	"USER_NOT_FOUND",
	"USER_NOT_MEMBER",
	"USER_OWNS_CONTENT",
	"USER_PREFERENCES_NOT_FOUND",
	"USER_UNBAN_FAILED",
	"VECTORIZE_RETRY_NOT_READY",
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
