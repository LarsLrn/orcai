import { sql } from "drizzle-orm";

/** Every advisory lock space in one place, so no two callers share one. */
export const lockSpaces = {
	linkPoints: 51830477,
	embeddingGenerations: 51830478,
	authzDelivery: 72370905,
	organizationWrites: 72370906,
} as const;

export type LockSpace = keyof typeof lockSpaces;

/** Takes the transaction's advisory lock on `key` in `space`; other takers wait until it ends. */
export const advisoryXactLock = (space: LockSpace, key: string) =>
	sql`SELECT pg_advisory_xact_lock(${lockSpaces[space]}, hashtext(${key}))`;

/** Takes the transaction's advisory lock on `key` in `space` shared: only an exclusive taker waits. */
export const advisoryXactLockShared = (space: LockSpace, key: string) =>
	sql`SELECT pg_advisory_xact_lock_shared(${lockSpaces[space]}, hashtext(${key}))`;
