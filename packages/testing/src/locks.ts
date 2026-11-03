import { PgClient } from "@effect/sql-pg";
import { applicationName, DB, type LockSpace, lockSpaces } from "@orcai/db";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";

/**
 * Takes what `lock` locks in a transaction of its own and holds it until the
 * returned effect releases it.
 */
export const holdLock = <E, R>(lock: Effect.Effect<unknown, E, R>) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const held = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		const holder = yield* Effect.forkDetach(
			db.transaction(() =>
				Effect.gen(function* () {
					yield* lock;
					yield* Deferred.succeed(held, undefined);
					yield* Deferred.await(release);
				}),
			),
		);
		yield* Effect.raceFirst(Deferred.await(held), Fiber.join(holder));
		return Deferred.succeed(release, undefined).pipe(
			Effect.andThen(Fiber.join(holder)),
			Effect.asVoid,
		);
	});

/** The advisory lock `key` in `space`, as `advisoryXactLock` takes it. */
export type AdvisoryLock = {
	readonly space: LockSpace;
	readonly key: string;
};

const waiters = (on: string | AdvisoryLock) =>
	Effect.gen(function* () {
		const sql = yield* PgClient.PgClient;
		const [waiting] =
			typeof on === "string"
				? yield* sql<{
						count: number;
					}>`SELECT count(*)::int AS count FROM pg_stat_activity
					   WHERE wait_event_type = 'Lock' AND application_name = ${applicationName}
					     AND query ILIKE ${on}`
				: yield* sql<{
						count: number;
					}>`SELECT count(*)::int AS count FROM pg_locks
					   WHERE locktype = 'advisory' AND NOT granted AND objsubid = 2
					     AND classid::bigint = ${lockSpaces[on.space]}
					     AND objid::bigint = (hashtext(${on.key})::bigint & 4294967295)`;
		return waiting?.count ?? 0;
	});

/**
 * Waits until `count` transactions wait on advisory lock `on`, or until
 * `count` of this process's queries matching `on` (ILIKE) wait on any lock.
 * Test files running in parallel wait on the same tables, so only this
 * process's queries count.
 */
export const awaitLockWaiters = (on: string | AdvisoryLock, count = 1) =>
	Effect.gen(function* () {
		while ((yield* waiters(on)) < count) yield* Effect.sleep("25 millis");
	}).pipe(Effect.timeout("20 seconds"));
