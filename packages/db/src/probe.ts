import type { ProbeResult } from "@orcai/core";
import { sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { DB } from "./service";

export const probeDatabase = Effect.gen(function* () {
	const db = yield* DB;
	const [row] = yield* db.execute<{
		version: string;
	}>(sql`SELECT current_setting('server_version') AS version`, "objects");

	return {
		ok: true,
		version: row?.version,
	} satisfies ProbeResult;
});

/** The newest migration recorded by drizzle-kit, if any ran. */
export const findLatestMigration = Effect.gen(function* () {
	const db = yield* DB;
	const [row] = yield* db.execute<{
		name: string | null;
		applied_at: Date | string | null;
	}>(
		sql`SELECT name, applied_at FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 1`,
		"objects",
	);

	return row?.name
		? {
				name: row.name,
				appliedAt: row.applied_at ? new Date(row.applied_at) : null,
			}
		: null;
});
