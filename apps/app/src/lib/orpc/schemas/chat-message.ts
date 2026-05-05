import { dbSchema } from "@orcai/db/schema";
import { chatIdSchema, chatMessageIdSchema } from "@orcai/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { z } from "zod/v4";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const chatMessageSelectSchema = createSelectSchema(
	dbSchema.chatMessage,
	{
		id: chatMessageIdSchema,
		chatId: chatIdSchema,
		parentMessageId: chatMessageIdSchema.nullable(),
	},
);

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const chatMessageInsertSchema = createInsertSchema(
	dbSchema.chatMessage,
	{
		id: chatMessageIdSchema,
		chatId: chatIdSchema,
		parentMessageId: chatMessageIdSchema.nullable().optional(),
	},
).omit({
	createdAt: true,
});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const chatMessageUpdateSchema = createUpdateSchema(
	dbSchema.chatMessage,
	{
		id: chatMessageSelectSchema.shape.id,
		chatId: chatIdSchema,
	},
).omit({
	createdAt: true,
});

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const chatMessageDeleteSchema = z.object({
	chatId: chatMessageSelectSchema.shape.chatId,
	refs: z.array(
		chatMessageUpdateSchema.pick({
			id: true,
		}),
	),
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
