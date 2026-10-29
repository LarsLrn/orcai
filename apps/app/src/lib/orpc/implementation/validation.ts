import {
	COMMON_ERROR_STATUS_MAP,
	ORPCError,
	ValidationError,
} from "@orpc/server";
import { z } from "zod/v4";

const toValidationFailure = (
	code: "INPUT_VALIDATION_FAILED" | "OUTPUT_VALIDATION_FAILED",
	cause: ValidationError,
) => {
	const zodError = new z.ZodError(cause.issues as z.core.$ZodIssue[]);

	return new ORPCError(code, {
		message: z.prettifyError(zodError),
		data: z.flattenError(zodError),
		cause,
	});
};

/** For `onError` in the client interceptors: names the fields a failed input or output validation rejected. */
export const describeValidationFailure = (error: unknown) => {
	if (!(error instanceof ORPCError && error.cause instanceof ValidationError)) {
		return;
	}

	if (error.code === "BAD_REQUEST") {
		throw toValidationFailure("INPUT_VALIDATION_FAILED", error.cause);
	}

	if (error.code === "INTERNAL_SERVER_ERROR") {
		throw toValidationFailure("OUTPUT_VALIDATION_FAILED", error.cause);
	}
};

/** For `errorStatusMap` in the handlers: oRPC answers codes it does not know with 400. */
export const errorStatusMap = {
	...COMMON_ERROR_STATUS_MAP,
	INPUT_VALIDATION_FAILED: 400,
	OUTPUT_VALIDATION_FAILED: 500,
};
