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

/** Repeat an operation while it answers one of `codes`. Only for operations safe to repeat. */
const untilOtherThan = async <T>(
	codes: readonly string[],
	operation: () => Promise<T>,
): Promise<T> => {
	const deadline = Date.now() + 15_000;

	for (;;) {
		try {
			return await operation();
		} catch (error) {
			if (
				!(error instanceof ORPCError) ||
				!codes.includes(error.code) ||
				Date.now() > deadline
			) {
				throw error;
			}

			await new Promise((resolve) => setTimeout(resolve, 250));
		}
	}
};

/**
 * Retry an operation while it answers FORBIDDEN, for a grant that is
 * asynchronous by design, such as the sign-up hook's membership.
 */
export const untilAllowed = <T>(operation: () => Promise<T>): Promise<T> =>
	untilOtherThan(
		[
			"FORBIDDEN",
		],
		operation,
	);
