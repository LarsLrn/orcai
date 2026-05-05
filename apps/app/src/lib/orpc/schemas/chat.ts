import { dbSchema } from "@orcai/db/schema";
import {
	botIdSchema,
	chatBranchIdSchema,
	chatIdSchema,
	modelIdSchema,
	providerIdSchema,
	userIdSchema,
} from "@orcai/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { z } from "zod/v4";

/**
 * ----------------
 * Chat Config Schema
 * ----------------
 */

export const chatConfigSchema = z.object({
	modelId: modelIdSchema.optional(),
	providerId: providerIdSchema.optional(),
	systemPrompt: z.string().optional(),
	temperature: z.number().min(0).max(2).optional(),
	maxTokens: z.number().int().min(1).optional(),
	topP: z.number().min(0).max(1).optional(),
	frequencyPenalty: z.number().min(-2).max(2).optional(),
	presencePenalty: z.number().min(-2).max(2).optional(),
});

export const chatConfigPatchSchema = chatConfigSchema.extend({
	modelId: modelIdSchema.nullable().optional(),
	providerId: providerIdSchema.nullable().optional(),
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
	activeBranchId: chatBranchIdSchema.nullable(),
	config: chatConfigSchema.nullable(),
	id: chatIdSchema,
	botId: botIdSchema.nullable(),
	userId: userIdSchema,
});

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const chatInsertSchema = createInsertSchema(dbSchema.chat, {
	botId: botIdSchema.optional(),
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
	id: chatIdSchema,
	title: z.string().min(1).max(250).optional(),
	activeBranchId: chatBranchIdSchema.optional(),
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
