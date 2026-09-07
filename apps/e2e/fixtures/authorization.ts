import { ORPCError } from "@orpc/client";
import { expect } from "@playwright/test";

/** The two codes a refused call answers with, depending on whether the handler checks or looks up first. */
export const DENIED = [
	"FORBIDDEN",
	"NOT_FOUND",
];

/** The oRPC error a call rejected with; fails when it resolved instead. */
export const rejection = async (
	promise: Promise<unknown>,
): Promise<ORPCError<string, unknown>> => {
	const error = await promise.then(
		() => undefined,
		(cause: unknown) => cause,
	);

	if (!(error instanceof ORPCError)) {
		throw new Error(
			`Expected an oRPC error, got ${error === undefined ? "a resolved promise" : String(error)}`,
		);
	}

	return error;
};

/** Assert a call is refused, either as forbidden or as not found. */
export const expectDenied = async (
	promise: Promise<unknown>,
): Promise<void> => {
	expect(DENIED).toContain((await rejection(promise)).code);
};

/** Assert a call is refused as forbidden, not merely hidden. */
export const expectForbidden = async (
	promise: Promise<unknown>,
): Promise<void> => {
	expect((await rejection(promise)).code).toBe("FORBIDDEN");
};

/** Retry an operation through snapshot lag while it answers FORBIDDEN. Only for operations safe to repeat. */
export const untilAllowed = async <T>(
	operation: () => Promise<T>,
): Promise<T> => {
	const deadline = Date.now() + 15_000;

	for (;;) {
		try {
			return await operation();
		} catch (error) {
			if (
				!(error instanceof ORPCError) ||
				error.code !== "FORBIDDEN" ||
				Date.now() > deadline
			) {
				throw error;
			}

			await new Promise((resolve) => setTimeout(resolve, 250));
		}
	}
};
