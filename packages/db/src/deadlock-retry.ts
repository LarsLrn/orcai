import { PgClient } from "@effect/sql-pg";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import { sqlFailure } from "./sql-failure";

const isDeadlock = (error: unknown) =>
	sqlFailure(error)?.reason._tag === "DeadlockError";

const backoff = Schedule.max([
	Schedule.exponential("25 millis"),
	Schedule.recurs(4),
]).pipe(Schedule.jittered);

/**
 * Runs the transaction again when Postgres aborts it to break a deadlock, so
 * it must be safe to re-run. Inside an enclosing transaction it runs once:
 * only the outermost one can be re-run.
 */
export const retryDeadlocks = <A, E, R>(transaction: Effect.Effect<A, E, R>) =>
	Effect.gen(function* () {
		const sql = yield* PgClient.PgClient;
		if (Option.isSome(yield* Effect.serviceOption(sql.transactionService)))
			return yield* transaction;
		return yield* transaction.pipe(
			Effect.retry({
				while: isDeadlock,
				schedule: backoff,
			}),
		);
	});
