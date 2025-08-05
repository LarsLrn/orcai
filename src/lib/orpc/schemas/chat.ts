import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { chat } from "@/db/schema/chat";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const chatSelectSchema = createSelectSchema(chat);

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const chatInsertSchema = createInsertSchema(chat).omit({
	userId: true,
	createdAt: true,
	updatedAt: true,
	id: true,
});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const chatUpdateSchema = createUpdateSchema(chat, {
	id: chatSelectSchema.shape.id,
	title: z.string().min(1).max(250),
}).omit({ userId: true, updatedAt: true, createdAt: true });

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const chatDeleteSchema = z.object({
	refs: z.array(chatUpdateSchema.pick({ id: true })),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Chat = z.infer<typeof chatSelectSchema>;
export type ChatInsert = z.infer<typeof chatInsertSchema>;
export type ChatUpdate = z.infer<typeof chatUpdateSchema>;
export type ChatDelete = z.infer<typeof chatDeleteSchema>;
