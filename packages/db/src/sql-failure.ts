import { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import * as Cause from "effect/Cause";
import { SqlError } from "effect/sql";

/** The SqlError behind `error`, also when Drizzle wraps it. */
export const sqlFailure = (error: unknown): SqlError.SqlError | undefined => {
	const failure =
		error instanceof EffectDrizzleQueryError && Cause.isCause(error.cause)
			? Cause.squash(error.cause)
			: error;
	return failure instanceof SqlError.SqlError ? failure : undefined;
};

/** The violated constraint when `error` is a unique violation. */
export const uniqueViolationConstraint = (
	error: unknown,
): string | undefined => {
	const reason = sqlFailure(error)?.reason;
	return reason?._tag === "UniqueViolation" ? reason.constraint : undefined;
};

/** Whether `error` is a lock wait that ran past `lock_timeout`. */
export const isLockTimeout = (error: unknown) =>
	sqlFailure(error)?.reason._tag === "LockTimeoutError";
