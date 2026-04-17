import { dbSchema } from "@orcai/db/schema";
import {
	chatBranchIdSchema,
	chatIdSchema,
	chatMessageIdSchema,
} from "@orcai/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const chatBranchSelectSchema = createSelectSchema(dbSchema.chatBranch, {
	id: chatBranchIdSchema,
	chatId: chatIdSchema,
	leafMessageId: chatMessageIdSchema.nullable(),
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
	id: chatBranchIdSchema,
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
	id: chatBranchIdSchema,
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
