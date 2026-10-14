import {
	type ErrorReason,
	NOT_FOUND_ENTITIES,
	type NotFoundEntity,
} from "@orcai/schema";
import { ORPCError } from "@orpc/client";
import { isErrorReason } from "@/lib/errors/is-error-reason";
import { ReasonError } from "@/lib/errors/reason-error";
import { reasonMessage } from "@/lib/errors/reason-messages";
import { m } from "@/paraglide/messages";

const ENTITIES = new Set<string>(NOT_FOUND_ENTITIES);

export { isErrorReason };

const isNotFoundEntity = (value: unknown): value is NotFoundEntity =>
	typeof value === "string" && ENTITIES.has(value);

export type ErrorReasonRef = {
	reason: ErrorReason;
	params?: unknown;
};

type ErrorData = {
	reason?: unknown;
	params?: unknown;
	entity?: unknown;
};

const dataOf = (error: ORPCError<string, unknown>): ErrorData =>
	error.data !== null && typeof error.data === "object"
		? (error.data as ErrorData)
		: {};

const ENTITY_REASONS: Record<NotFoundEntity, ErrorReason> = {
	asset: "ASSET_NOT_FOUND",
	block: "BLOCK_NOT_FOUND",
	bot: "BOT_NOT_FOUND",
	chat: "CHAT_NOT_FOUND",
	chatBranch: "CHAT_BRANCH_NOT_FOUND",
	chatMessage: "CHAT_MESSAGE_NOT_FOUND",
	group: "GROUP_NOT_FOUND",
	invitation: "INVITATION_NOT_FOUND",
	member: "MEMBER_NOT_FOUND",
	model: "MODEL_NOT_FOUND",
	organization: "ORGANIZATION_NOT_FOUND",
	provider: "PROVIDER_NOT_FOUND",
	quotaPool: "QUOTA_POOL_NOT_FOUND",
	repository: "REPOSITORY_NOT_FOUND",
	user: "USER_NOT_FOUND",
};

/**
 * The reason an error carries: an oRPC error's `data.reason`, a `ReasonError`,
 * or a bare reason used as a message by a stream or a tool result.
 */
export const errorReasonOf = (error: unknown): ErrorReasonRef | undefined => {
	if (error instanceof ReasonError) {
		return {
			reason: error.reason,
			params: error.params,
		};
	}

	if (error instanceof ORPCError) {
		const data = dataOf(error);

		if (isErrorReason(data.reason)) {
			return {
				reason: data.reason,
				params: data.params,
			};
		}

		if (isNotFoundEntity(data.entity)) {
			return {
				reason: ENTITY_REASONS[data.entity],
			};
		}

		return undefined;
	}

	const text = error instanceof Error ? error.message : error;

	return isErrorReason(text)
		? {
				reason: text,
			}
		: undefined;
};

/** The translated reason, or nothing when the error has none. Raw errors go to the console. */
export const reasonMessageOf = (error: unknown): string | undefined => {
	const ref = errorReasonOf(error);

	if (!ref) {
		console.error(error);
		return undefined;
	}

	return reasonMessage(ref.reason, ref.params);
};

const codeMessage = (code: string): string => {
	switch (code) {
		case "BAD_REQUEST":
			return m.error_generic_bad_request();
		case "INPUT_VALIDATION_FAILED":
			return m.error_generic_validation();
		case "UNAUTHORIZED":
			return m.error_generic_unauthorized();
		case "FORBIDDEN":
			return m.error_generic_forbidden();
		case "NOT_FOUND":
			return m.error_generic_not_found();
		case "CONFLICT":
			return m.error_generic_conflict();
		case "INTERNAL_SERVER_ERROR":
			return m.error_generic_internal();
		default:
			return m.error_generic_unknown();
	}
};

/** Always a translated sentence: the reason, else a generic one for the transport code. */
export const describeError = (error: unknown): string => {
	const message = reasonMessageOf(error);

	if (message) {
		return message;
	}

	if (error instanceof ORPCError) {
		return codeMessage(error.code);
	}

	return m.error_generic_unknown();
};
