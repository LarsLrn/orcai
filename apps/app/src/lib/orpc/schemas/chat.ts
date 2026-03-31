import { dbSchema } from "@orcai/db/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";

/**
 * ----------------
 * Chat Config Schema
 * ----------------
 */

export const chatConfigSchema = z.object({
	modelId: z.string().optional(),
	providerId: z.string().optional(),
	systemPrompt: z.string().optional(),
	temperature: z.number().min(0).max(2).optional(),
	maxTokens: z.number().int().min(1).optional(),
	topP: z.number().min(0).max(1).optional(),
	frequencyPenalty: z.number().min(-2).max(2).optional(),
	presencePenalty: z.number().min(-2).max(2).optional(),
});

export const chatConfigPatchSchema = chatConfigSchema.extend({
	modelId: z.string().nullable().optional(),
	providerId: z.string().nullable().optional(),
	systemPrompt: z.string().nullable().optional(),
	temperature: z.number().min(0).max(2).nullable().optional(),
	maxTokens: z.number().int().min(1).nullable().optional(),
	topP: z.number().min(0).max(1).nullable().optional(),
	frequencyPenalty: z.number().min(-2).max(2).nullable().optional(),
	presencePenalty: z.number().min(-2).max(2).nullable().optional(),
});

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const chatSelectSchema = createSelectSchema(dbSchema.chat, {
	id: (schema) => schema.brand("chatId"),
	activeBranchId: (schema) => schema.brand("chatBranchId"),
	config: chatConfigSchema.nullable(),
});

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const chatInsertSchema = createInsertSchema(dbSchema.chat, {
	config: chatConfigSchema.optional(),
}).omit({
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

export const chatUpdateSchema = createUpdateSchema(dbSchema.chat, {
	id: chatSelectSchema.shape.id,
	title: z.string().min(1).max(250).optional(),
	activeBranchId: z.uuidv4().optional(),
	config: chatConfigPatchSchema.optional(),
}).omit({
	userId: true,
	updatedAt: true,
	createdAt: true,
});

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const chatDeleteSchema = z.object({
	refs: z.array(
		chatUpdateSchema.pick({
			id: true,
		}),
	),
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
export type ChatConfig = z.infer<typeof chatConfigSchema>;
export type ChatConfigPatch = z.infer<typeof chatConfigPatchSchema>;
