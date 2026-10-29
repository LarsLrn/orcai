import { PgClient } from "@effect/sql-pg";
import { applicationName } from "@orcai/db";
import * as Effect from "effect/Effect";

/**
 * Waits until `count` of this process's queries matching `query` (ILIKE) wait
 * on a lock. Test files running in parallel wait on the same tables, so only
 * this process's connections count.
 */
export const awaitLockWaiters = (query: string, count = 1) =>
	Effect.gen(function* () {
		const sql = yield* PgClient.PgClient;
		for (;;) {
			const [waiting] = yield* sql<{
				count: number;
			}>`SELECT count(*)::int AS count FROM pg_stat_activity
			   WHERE wait_event_type = 'Lock' AND application_name = ${applicationName}
			     AND query ILIKE ${query}`;
			if ((waiting?.count ?? 0) >= count) return;
			yield* Effect.sleep("25 millis");
		}
	}).pipe(Effect.timeout("20 seconds"));
