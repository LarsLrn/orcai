import type { ErrorReason } from "@orcai/schema";
import { isErrorReason } from "@/lib/errors/is-error-reason";

/** The reason a stream or tool failure carries; the AI SDK sends it to the client as error text. */
export const streamErrorReason = (
	error: unknown,
	fallback: ErrorReason,
): ErrorReason => {
	if (
		typeof error === "object" &&
		error !== null &&
		"reason" in error &&
		isErrorReason(error.reason)
	) {
		return error.reason;
	}

	if (error instanceof Error && isErrorReason(error.message)) {
		return error.message;
	}

	return fallback;
};
