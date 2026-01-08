import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { chatBranch } from "@/db/schema/chat-branch";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const chatBranchSelectSchema = createSelectSchema(chatBranch);

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const chatBranchInsertSchema = createInsertSchema(chatBranch).omit({
	createdAt: true,
	updatedAt: true,
});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const chatBranchUpdateSchema = createUpdateSchema(chatBranch).omit({
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
