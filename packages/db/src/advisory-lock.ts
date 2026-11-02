import { sql } from "drizzle-orm";

/** Takes the transaction's advisory lock on `key` in `space`; other takers wait until it ends. */
export const advisoryXactLock = (space: number, key: string) =>
	sql`SELECT pg_advisory_xact_lock(${space}, hashtext(${key}))`;

/** Takes the transaction's advisory lock on `key` in `space` shared: only an exclusive taker waits. */
export const advisoryXactLockShared = (space: number, key: string) =>
	sql`SELECT pg_advisory_xact_lock_shared(${space}, hashtext(${key}))`;
