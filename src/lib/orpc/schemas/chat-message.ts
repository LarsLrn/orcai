import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { chatMessage } from "@/db/schema/chat-message";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const chatMessageSelectSchema = createSelectSchema(chatMessage);

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const chatMessageInsertSchema = createInsertSchema(chatMessage).omit({
	createdAt: true,
});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const chatMessageUpdateSchema = createUpdateSchema(chatMessage, {
	id: chatMessageSelectSchema.shape.id,
	chatId: chatMessageSelectSchema.shape.chatId,
}).omit({ createdAt: true });

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const chatMessageDeleteSchema = z.object({
	chatId: chatMessageSelectSchema.shape.chatId,
	refs: z.array(chatMessageUpdateSchema.pick({ id: true })),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type ChatMessage = z.infer<typeof chatMessageSelectSchema>;
export type ChatMessageInsert = z.infer<typeof chatMessageInsertSchema>;
export type ChatMessageUpdate = z.infer<typeof chatMessageUpdateSchema>;
export type ChatMessageDelete = z.infer<typeof chatMessageDeleteSchema>;
