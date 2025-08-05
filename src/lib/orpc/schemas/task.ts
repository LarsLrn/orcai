import { z } from "zod/v4";

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const taskInsertSchema = z.object({
	taskType: z.enum(["extract", "embed"]),
	ids: z.array(z.string()),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type TaskInsert = z.infer<typeof taskInsertSchema>;
