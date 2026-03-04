import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { dbSchema } from "@/db/schema";
import { baseBlockSelectSchema } from "./block";
import { taskStatus } from "./fragments/task-status";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const taskSelectSchema = createSelectSchema(dbSchema.task, {
	status: taskStatus,
});

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const taskInsertSchema = createInsertSchema(dbSchema.task).omit({
	status: true,
	createdAt: true,
	updatedAt: true,
});

export const databaseBlockTaskInsertSchema = z.object({
	taskType: z.enum([
		"extract",
		"embed",
	]),
	blockId: baseBlockSelectSchema.shape.id,
});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const taskUpdateSchema = createUpdateSchema(dbSchema.task, {
	resourceId: z.string(),
	status: taskStatus.optional(),
	runId: z.string(),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Task = z.infer<typeof taskSelectSchema>;
export type TaskInsert = z.infer<typeof taskInsertSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
