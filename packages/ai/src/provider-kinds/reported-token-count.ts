import { z } from "zod/v4";

/** A token count from a models API; a missing or implausible one reads as unknown. */
export const reportedTokenCount = z.int32().positive().nullable().catch(null);
