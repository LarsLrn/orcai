import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { course } from "@/db/schema/course";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const courseSelectSchema = createSelectSchema(course);

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const courseInsertSchema = createInsertSchema(course, {
	organizationId: (schema) => schema.optional(),
	description: (schema) =>
		schema.min(20, {
			message: "Description must be at least 20 characters long",
		}),
	contentJson: z
		.json()
		.refine(
			(val) =>
				val !== null &&
				typeof val === "object" &&
				!Array.isArray(val) &&
				Object.keys(val as object).length > 0,
			{ message: "Content is required" },
		),
	// TODO: Coerce received string for maxReferences
	config: z.object({
		systemPrompt: z.string(),
		maxReferences: z.number().min(1).max(20),
		model: z.string(),
	}),
});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const courseUpdateSchema = createUpdateSchema(course, {
	id: courseSelectSchema.shape.id,
});

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const courseDeleteSchema = z.object({
	refs: z.array(courseUpdateSchema.pick({ id: true })),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Course = z.infer<typeof courseSelectSchema>;
export type CourseInsert = z.infer<typeof courseInsertSchema>;
export type CourseUpdate = z.infer<typeof courseUpdateSchema>;
export type CourseDelete = z.infer<typeof courseDeleteSchema>;
