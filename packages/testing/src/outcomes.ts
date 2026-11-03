import { DB } from "@orcai/db";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";

/** What `operation` rejects with, or undefined when it resolves. */
export const rejection = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: unknown) => error,
	);

/** The `reason` of what `operation` rejects with, or undefined when it resolves. */
export const reasonOf = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: { reason?: string }) => error.reason,
	);

class RolledBack<A> extends Data.TaggedError("RolledBack")<{
	readonly value: A;
}> {}

/**
 * Runs `body` in a transaction that is rolled back and returns its value, so
 * nothing it writes reaches other test files, which may be draining the same
 * tables.
 */
export const rolledBack = <A, E, R>(body: Effect.Effect<A, E, R>) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db
			.transaction(() =>
				Effect.flatMap(body, (value) =>
					Effect.fail(
						new RolledBack({
							value,
						}),
					),
				),
			)
			.pipe(
				Effect.catchIf(
					(error): error is RolledBack<A> => error instanceof RolledBack,
					({ value }) => Effect.succeed(value),
				),
			);
	});
