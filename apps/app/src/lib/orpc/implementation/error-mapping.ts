import { ORPCError, type ORPCErrorCode } from "@orpc/server";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { type AppError, ErrorTags } from "@/lib/effect/utils/errors";

type AnyORPCError = ORPCError<ORPCErrorCode, unknown>;

const APP_ERROR_TAGS = new Set<string>(Object.values(ErrorTags));
const PUBLIC_ERROR_TAGS = new Set<string>([
	ErrorTags.NOT_FOUND,
	ErrorTags.CONFLICT,
	ErrorTags.UNAUTHORIZED,
	ErrorTags.FORBIDDEN,
	ErrorTags.VALIDATION,
	ErrorTags.BAD_REQUEST,
]);

const isAppError = (error: unknown): error is AppError => {
	return (
		error !== null &&
		typeof error === "object" &&
		"_tag" in error &&
		typeof error._tag === "string" &&
		APP_ERROR_TAGS.has(error._tag)
	);
};

const appErrorMessage = (error: AppError): string => {
	if (!PUBLIC_ERROR_TAGS.has(error._tag)) {
		return "Internal server error";
	}

	if ("message" in error && typeof error.message === "string") {
		return error.message;
	}

	if ("reason" in error && typeof error.reason === "string") {
		return error.reason;
	}

	switch (error._tag) {
		case "NotFoundError":
			return error.entity ? `${error.entity} not found` : "Resource not found.";
		case "ConflictError":
			return error.entity ? `${error.entity} conflict` : "Conflict.";
		case "UnauthorizedError":
			return "Unauthorized access.";
		case "ForbiddenError":
			return "Forbidden access.";
		case "BadRequestError":
		case "ValidationError":
			return "Bad request.";
		default:
			return "Internal server error";
	}
};

const appErrorToCode = (error: AppError): ORPCErrorCode => {
	switch (error._tag) {
		case ErrorTags.NOT_FOUND:
			return "NOT_FOUND";
		case ErrorTags.UNAUTHORIZED:
			return "UNAUTHORIZED";
		case ErrorTags.FORBIDDEN:
			return "FORBIDDEN";
		case ErrorTags.BAD_REQUEST:
		case ErrorTags.VALIDATION:
			return "BAD_REQUEST";
		case ErrorTags.CONFLICT:
			return "CONFLICT";
		default:
			return "INTERNAL_SERVER_ERROR";
	}
};

const appErrorToORPCError = (error: AppError): AnyORPCError => {
	const data =
		PUBLIC_ERROR_TAGS.has(error._tag) &&
		"data" in error &&
		error.data !== undefined
			? error.data
			: undefined;

	return new ORPCError(appErrorToCode(error), {
		message: appErrorMessage(error),
		data,
		cause: error,
	});
};

export const unknownToORPCError = (error: unknown): AnyORPCError => {
	if (error instanceof ORPCError) {
		return error as AnyORPCError;
	}

	if (isAppError(error)) {
		return appErrorToORPCError(error);
	}

	return new ORPCError("INTERNAL_SERVER_ERROR", {
		message: "Internal server error",
		cause: error,
	});
};

export const causeToORPCError = (cause: Cause.Cause<unknown>): AnyORPCError => {
	const failure = Cause.findErrorOption(cause);
	if (Option.isSome(failure)) {
		return unknownToORPCError(failure.value);
	}

	const defect = Cause.findDefect(cause);
	if (Result.isSuccess(defect)) {
		return unknownToORPCError(defect.success);
	}

	return new ORPCError("INTERNAL_SERVER_ERROR", {
		message: "Internal server error",
		cause: Cause.pretty(cause),
	});
};
