import type { ErrorReason } from "@orcai/schema";
import { isErrorReason } from "@/lib/errors/is-error-reason";
import { ReasonError } from "@/lib/errors/reason-error";

// Better Auth's own codes that have a reason of ours; our server hooks throw
// reasons as codes directly and pass through below.
const AUTH_CODE_REASONS: Record<string, ErrorReason> = {
	ACCOUNT_TEMPORARILY_LOCKED: "TWO_FACTOR_LOCKED",
	BANNED_USER: "USER_BANNED",
	EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
	INVALID_BACKUP_CODE: "TWO_FACTOR_CODE_INVALID",
	INVALID_CODE: "TWO_FACTOR_CODE_INVALID",
	INVALID_EMAIL_OR_PASSWORD: "INVALID_CREDENTIALS",
	INVALID_PASSWORD: "CURRENT_PASSWORD_INCORRECT",
	INVALID_TOKEN: "TOKEN_INVALID",
	INVALID_TWO_FACTOR_COOKIE: "TWO_FACTOR_CHALLENGE_EXPIRED",
	TOKEN_EXPIRED: "TOKEN_INVALID",
	TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: "TWO_FACTOR_CHALLENGE_EXPIRED",
	USER_ALREADY_EXISTS: "EMAIL_ALREADY_REGISTERED",
	USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "EMAIL_ALREADY_REGISTERED",
	USER_NOT_FOUND: "USER_NOT_FOUND",
};

const authErrorReason = (code: string | undefined): ErrorReason | undefined => {
	if (!code) {
		return undefined;
	}

	if (isErrorReason(code)) {
		return code;
	}

	return AUTH_CODE_REASONS[code];
};

type AuthClientError = {
	code?: string | undefined;
	message?: string | undefined;
};

/** Turns a Better Auth client error into a reason-carrying error; the English stays in the console. */
export const toAuthError = (error: AuthClientError): Error => {
	const reason = authErrorReason(error.code);

	if (reason) {
		return new ReasonError(reason);
	}

	console.error("auth error without reason", error);
	return new Error(error.message ?? "Authentication failed");
};
