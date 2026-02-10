import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { dbSchema } from "@/db/schema";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

const preferencesSchema = z.object({
	tours: z
		.object({
			initialTour: z.enum(["completed", "skipped"]).optional(),
			chatTour: z.enum(["completed", "skipped"]).optional(),
		})
		.optional(),
});

export type UserPreferencesType = z.infer<typeof preferencesSchema>;

export const userSelectSchema = createSelectSchema(dbSchema.user).extend({
	preferences: preferencesSchema.optional(),
});

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const userInsertSchema = createInsertSchema(dbSchema.user).extend({
	preferences: preferencesSchema.optional(),
});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const userUpdateSchema = createUpdateSchema(dbSchema.user);

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const userDeleteSchema = z.object({
	refs: z.array(userSelectSchema.pick({ id: true })),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type User = z.infer<typeof userSelectSchema>;
export type UserInsert = z.infer<typeof userInsertSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
export type UserDelete = z.infer<typeof userDeleteSchema>;
