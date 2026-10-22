/** The longest a metered call runs; the AI SDK stops it there. */
export const METERED_CALL_TIMEOUT_MS = 30 * 60 * 1000;

/** A reservation this old belongs to a call that can no longer settle it. */
export const STALE_RESERVATION_AGE_MS = METERED_CALL_TIMEOUT_MS + 5 * 60 * 1000;
