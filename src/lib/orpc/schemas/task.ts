import { z } from "zod/v4";
import { baseBlockSelectSchema } from "./block";

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const taskInsertSchema = z.object({
	taskType: z.enum(["extract", "embed"]),
	ids: z.array(z.string()),
	blockId: baseBlockSelectSchema.shape.id,
});

export const databaseBlockTaskInsertSchema = z.object({
	taskType: z.enum(["extract", "embed"]),
	blockId: baseBlockSelectSchema.shape.id,
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type TaskInsert = z.infer<typeof taskInsertSchema>;
