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

export const chatBranchSelectSchema = createSelectSchema(dbSchema.chatBranch, {
	id: (schema) => schema.brand("chatBranchId"),
});

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const chatBranchInsertSchema = createInsertSchema(
	dbSchema.chatBranch,
).omit({
	createdAt: true,
	updatedAt: true,
	id: true,
});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const chatBranchUpdateSchema = createUpdateSchema(dbSchema.chatBranch, {
	id: chatBranchSelectSchema.shape.id,
}).omit({
	createdAt: true,
	updatedAt: true,
});

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const chatBranchDeleteSchema = z.object({
	id: chatBranchSelectSchema.shape.id,
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type ChatBranch = z.infer<typeof chatBranchSelectSchema>;
export type ChatBranchInsert = z.infer<typeof chatBranchInsertSchema>;
export type ChatBranchUpdate = z.infer<typeof chatBranchUpdateSchema>;
export type ChatBranchDelete = z.infer<typeof chatBranchDeleteSchema>;
