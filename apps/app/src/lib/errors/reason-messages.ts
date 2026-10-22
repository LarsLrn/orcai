import type {
	ErrorParamsOf,
	ErrorReason,
	ErrorReasonWithParams,
	GrantRejection,
	GrantRejectionReason,
} from "@orcai/schema";
import { featureLabel } from "@/components/features/feature-labels";
import { formatList } from "@/lib/presentation/format-list";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";

type ReasonMessages = {
	[R in ErrorReason]: (params: ErrorParamsOf<R>) => string;
};

const grantRejectionMessages: Record<GrantRejectionReason, () => string> = {
	ALL_MEMBERS_VIEWER_ONLY: m.error_grant_rejection_all_members_viewer_only,
	GROUP_NOT_IN_SCOPE: m.error_grant_rejection_group_not_in_scope,
	GROUP_NOT_JOINED: m.error_grant_rejection_group_not_joined,
	USER_NOT_IN_SCOPE: m.error_grant_rejection_user_not_in_scope,
};

const grantRejections = (rejections: GrantRejection[]) =>
	[
		...new Set(rejections.map((rejection) => rejection.reason)),
	].map((reason) => grantRejectionMessages[reason]());

// One entry per reason; a reason without an entry does not compile.
const reasonMessages: ReasonMessages = {
	ACTIVE_ORGANIZATION_REQUIRED: m.error_active_organization_required,
	AI_PROMPT_REQUIRED: m.error_ai_prompt_required,
	AI_STREAM_FAILED: m.error_ai_stream_failed,
	AI_TOOL_FAILED: m.error_ai_tool_failed,
	ALREADY_EXISTS: m.error_already_exists,
	ASSET_LINK_FORBIDDEN: m.error_asset_link_forbidden,
	ASSET_NOT_ATTACHED: m.error_asset_not_attached,
	ASSET_NOT_FOUND: m.error_asset_not_found,
	ASSISTANT_CONVERSATION_IMMUTABLE: m.error_assistant_conversation_immutable,
	ASSISTANT_MODEL_NOT_CONFIGURED: m.error_assistant_model_not_configured,
	ASSISTANT_ORGANIZATION_MISMATCH: m.error_assistant_organization_mismatch,
	AUTH_REQUIRED: m.error_auth_required,
	BEHAVIOUR_BLOCK_TYPE_INVALID: m.error_behaviour_block_type_invalid,
	BLOCK_IN_USE_BY_READY_BOTS: ({ botNames }) =>
		m.error_block_in_use_by_ready_bots({
			botNames: formatList(botNames),
		}),
	BLOCK_LINK_FORBIDDEN: m.error_block_link_forbidden,
	BLOCK_NOT_FOUND: m.error_block_not_found,
	BOOTSTRAP_USER_CREATE_FAILED: m.error_bootstrap_user_create_failed,
	BOT_BEHAVIOUR_BLOCK_NOT_READY: m.error_bot_behaviour_block_not_ready,
	BOT_BEHAVIOUR_BLOCK_REQUIRED: m.error_bot_behaviour_block_required,
	BOT_NOT_FOUND: m.error_bot_not_found,
	BOT_NOT_PUBLISHED: m.error_bot_not_published,
	BOT_REPOSITORY_EMPTY: ({ blockName }) =>
		m.error_bot_repository_empty({
			blockName,
		}),
	BOT_REPOSITORY_NOT_READY: ({ blockName }) =>
		m.error_bot_repository_not_ready({
			blockName,
		}),
	CHAT_BLOCKS_UNAVAILABLE: m.error_chat_blocks_unavailable,
	CHAT_BOT_BLOCKS_IMMUTABLE: m.error_chat_bot_blocks_immutable,
	CHAT_BOT_FEATURES_IMMUTABLE: m.error_chat_bot_features_immutable,
	CHAT_CONTEXT_TOO_LONG: m.error_chat_context_too_long,
	CHAT_MAX_TOKENS_EXCEEDS_MODEL: ({ maxOutputTokens }) =>
		m.error_chat_max_tokens_exceeds_model({
			maxOutputTokens: formatCount(maxOutputTokens),
		}),
	CHAT_MESSAGE_CREATE_FAILED: m.error_chat_message_create_failed,
	CHAT_MESSAGE_ID_TAKEN: m.error_chat_message_id_taken,
	CHAT_MESSAGE_NOT_FOUND: m.error_chat_message_not_found,
	CHAT_MODEL_NOT_CONFIGURED: m.error_chat_model_not_configured,
	CHAT_NOT_FOUND: m.error_chat_not_found,
	CHAT_RATING_FAILED: m.error_chat_rating_failed,
	CHAT_TEMPLATE_BLOCK_ALREADY_ATTACHED:
		m.error_chat_template_block_already_attached,
	CHAT_TOOL_OUTPUT_INVALID: m.error_chat_tool_output_invalid,
	CHAT_TURN_DECISIONS_INCOMPLETE: m.error_chat_turn_decisions_incomplete,
	CHAT_TURN_NOT_AWAITING: m.error_chat_turn_not_awaiting,
	CURRENT_PASSWORD_INCORRECT: m.error_current_password_incorrect,
	DATA_EXPORT_IN_PROGRESS: m.error_data_export_in_progress,
	DEFAULT_REFERENCES_OUT_OF_RANGE: m.error_default_references_out_of_range,
	DOCUMENT_STILL_PREPARING: m.error_document_still_preparing,
	EMAIL_ALREADY_REGISTERED: m.error_email_already_registered,
	EMAIL_NOT_VERIFIED: m.error_email_not_verified,
	ENTITY_IDS_REQUIRED: m.error_entity_ids_required,
	FEATURE_REQUIREMENT_MISSING: ({ feature, requirement }) =>
		m.error_feature_requirement_missing({
			feature: featureLabel(feature),
			requirement: featureLabel(requirement),
		}),
	GRANT_PRINCIPALS_INVALID: ({ rejections }) =>
		[
			m.error_grant_principals_invalid(),
			...grantRejections(rejections),
		].join(" "),
	GROUP_MEMBERS_INVALID: m.error_group_members_invalid,
	GROUP_NOT_FOUND: m.error_group_not_found,
	INSTANCE_ADMIN_REQUIRED: m.error_instance_admin_required,
	INSTANCE_ALREADY_INITIALISED: m.error_instance_already_initialised,
	INSTANCE_ROLE_INVALID: m.error_instance_role_invalid,
	INVALID_CREDENTIALS: m.error_invalid_credentials,
	INVALID_TOOL_INPUT: m.error_invalid_tool_input,
	INVITATION_ALREADY_ACCEPTED: m.error_invitation_already_accepted,
	INVITATION_CHANGED: m.error_invitation_changed,
	INVITATION_EXPIRED: m.error_invitation_expired,
	INVITATION_NOT_FOUND: m.error_invitation_not_found,
	INVITATION_REQUIRED: m.error_invitation_required,
	INVITATION_RESPONSE_FORBIDDEN: m.error_invitation_response_forbidden,
	INVITATION_RESPONSE_INVALID: m.error_invitation_response_invalid,
	ITEMS_NOT_UNIQUE: m.error_items_not_unique,
	LAST_MANAGER_REQUIRED: m.error_last_manager_required,
	LAST_ORGANIZATION_ADMIN_REQUIRED: m.error_last_organization_admin_required,
	MEMBER_NOT_FOUND: m.error_member_not_found,
	MODEL_DEPRECATED: m.error_model_deprecated,
	MODEL_NOT_FOUND: m.error_model_not_found,
	MODEL_PROVIDER_MISMATCH: m.error_model_provider_mismatch,
	MODEL_TEXT_UNSUPPORTED: m.error_model_text_unsupported,
	MODEL_TOOLS_UNSUPPORTED: m.error_model_tools_unsupported,
	MUTABLE_FIELD_REQUIRED: m.error_mutable_field_required,
	ORGANIZATION_ADMIN_REQUIRED: m.error_organization_admin_required,
	ORGANIZATION_MEMBERSHIP_REVOKED: m.error_organization_membership_revoked,
	ORGANIZATION_NOT_FOUND: m.error_organization_not_found,
	PASSWORD_NOT_SET: m.error_password_not_set,
	PASSWORDS_MISMATCH: m.error_passwords_mismatch,
	PERMISSION_DENIED: m.error_permission_denied,
	PRIVACY_CONSENT_REQUIRED: m.error_privacy_consent_required,
	PROVIDER_DISABLED: m.error_provider_disabled,
	PROVIDER_COST_REPORTING_NOT_ALLOWED:
		m.error_provider_cost_reporting_not_allowed,
	PROVIDER_CURRENCY_NOT_ALLOWED: m.error_provider_currency_not_allowed,
	PROVIDER_ENDPOINT_NOT_ALLOWED: m.error_provider_endpoint_not_allowed,
	PROVIDER_ENDPOINT_REQUIRED: m.error_provider_endpoint_required,
	PROVIDER_METERING_MODE_NOT_ALLOWED:
		m.error_provider_metering_mode_not_allowed,
	PROVIDER_MODELS_FETCH_FAILED: m.error_provider_models_fetch_failed,
	PROVIDER_NOT_FOUND: m.error_provider_not_found,
	PROVIDER_PURPOSE_MISMATCH: m.error_provider_purpose_mismatch,
	PROVIDER_SEARCH_PRICE_NOT_ALLOWED: m.error_provider_search_price_not_allowed,
	QUOTA_CHECK_FAILED: m.error_quota_check_failed,
	QUOTA_EXHAUSTED: m.error_quota_exhausted,
	QUOTA_GROUPS_INVALID: m.error_quota_groups_invalid,
	QUOTA_POOL_NOT_FOUND: m.error_quota_pool_not_found,
	QUOTA_POOL_UNAVAILABLE: m.error_quota_pool_unavailable,
	REFERENCE_RANGE_INVALID: m.error_reference_range_invalid,
	REPOSITORY_BLOCK_TYPE_INVALID: m.error_repository_block_type_invalid,
	REPOSITORY_NOT_FOUND: m.error_repository_not_found,
	REQUEST_HEADERS_REQUIRED: m.error_request_headers_required,
	RESOURCE_SCOPE_REQUIRED: m.error_resource_scope_required,
	SELF_BAN_FORBIDDEN: m.error_self_ban_forbidden,
	SELF_DELETE_FORBIDDEN: m.error_self_delete_forbidden,
	SELF_INSTANCE_ROLE_CHANGE_FORBIDDEN:
		m.error_self_instance_role_change_forbidden,
	SELF_TWO_FACTOR_RESET_FORBIDDEN: m.error_self_two_factor_reset_forbidden,
	SESSION_NOT_FOUND: m.error_session_not_found,
	SORT_KEY_UNSUPPORTED: ({ sortKey }) =>
		m.error_sort_key_unsupported({
			sortKey,
		}),
	SYSTEM_GROUP_IMMUTABLE: m.error_system_group_immutable,
	TOKEN_INVALID: m.error_token_invalid,
	TOOL_NOT_AVAILABLE: m.error_tool_not_available,
	TWO_FACTOR_CHALLENGE_EXPIRED: m.error_two_factor_challenge_expired,
	TWO_FACTOR_CODE_INVALID: m.error_two_factor_code_invalid,
	TWO_FACTOR_LOCKED: m.error_two_factor_locked,
	TWO_FACTOR_REQUIRED: m.error_two_factor_required,
	UPLOAD_CREATE_FAILED: m.error_upload_create_failed,
	UPLOAD_FILE_MISSING: m.error_upload_file_missing,
	UPLOAD_FILE_SIZE_MISMATCH: m.error_upload_file_size_mismatch,
	UPLOAD_FILE_TOO_LARGE: ({ fileName }) =>
		m.error_upload_file_too_large({
			fileName,
		}),
	UPLOAD_FILE_TYPE_INVALID: ({ fileName, fileType }) =>
		m.error_upload_file_type_invalid({
			fileName,
			fileType,
		}),
	UPLOAD_INIT_FAILED: m.error_upload_init_failed,
	UPLOAD_REQUEST_INVALID: m.error_upload_request_invalid,
	UPLOAD_TOO_MANY_FILES: ({ maxFiles }) =>
		m.error_upload_too_many_files({
			maxFiles,
		}),
	USER_BANNED: m.error_user_banned,
	USER_NOT_FOUND: m.error_user_not_found,
	USER_NOT_MEMBER: m.error_user_not_member,
	USER_OWNS_CONTENT: m.error_user_owns_content,
	USER_PREFERENCES_NOT_FOUND: m.error_user_preferences_not_found,
	USER_UNBAN_FAILED: m.error_user_unban_failed,
	WEB_SEARCH_FAILED: m.error_web_search_failed,
};

/** Params arrive untyped from the wire; the message for a reason trusts their shape. */
export const reasonMessage = (reason: ErrorReason, params: unknown): string =>
	(reasonMessages[reason] as (params: unknown) => string)(params);

const reasonsWithParams: Record<ErrorReasonWithParams, true> = {
	BLOCK_IN_USE_BY_READY_BOTS: true,
	BOT_REPOSITORY_EMPTY: true,
	BOT_REPOSITORY_NOT_READY: true,
	CHAT_MAX_TOKENS_EXCEEDS_MODEL: true,
	FEATURE_REQUIREMENT_MISSING: true,
	GRANT_PRINCIPALS_INVALID: true,
	GROUP_MEMBERS_INVALID: true,
	SORT_KEY_UNSUPPORTED: true,
	UPLOAD_FILE_TOO_LARGE: true,
	UPLOAD_FILE_TYPE_INVALID: true,
	UPLOAD_TOO_MANY_FILES: true,
};

/** The message of a reason that arrived without its params, when it needs none. */
export const paramlessReasonMessage = (
	reason: ErrorReason,
): string | undefined =>
	Object.hasOwn(reasonsWithParams, reason)
		? undefined
		: reasonMessage(reason, undefined);
