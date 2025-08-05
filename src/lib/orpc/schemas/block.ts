import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { blockTable } from "@/db/schema/block";

/**
 * ----------------
 * Select Schema
 * ----------------
 */
export const templateBlockSchema = z.object({
	type: z.literal("template"),
	systemPrompt: z.string(),
	model: z.string(),
	provider: z.string(),
});

export const databaseBlockSchema = z.object({
	type: z.literal("database"),
	embeddingModel: z.string(),
});

export const blockSelectSchema = createSelectSchema(blockTable, {
	type: z.enum(["template", "database"]),
}).extend({
	config: z.discriminatedUnion("type", [
		templateBlockSchema,
		databaseBlockSchema,
	]),
});

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

const baseBlockInsertSchema = createInsertSchema(blockTable, {
	type: z.enum(["template", "database"]),
}).omit({
	userId: true,
	createdAt: true,
	updatedAt: true,
	id: true,
});

export const blockInsertSchema = z.discriminatedUnion("type", [
	baseBlockInsertSchema.extend({
		type: z.literal("template"),
		assets: z.array(z.string()).optional(),
	}),
	baseBlockInsertSchema.extend({
		type: z.literal("database"),
		embeddingModel: z.string(),
		assets: z
			.array(z.string())
			.min(1, "At least one asset is required for database blocks"),
	}),
]);

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const blockUpdateSchema = createUpdateSchema(blockTable, {
	id: z.uuidv4(),
	title: z.string().min(1).max(250),
	type: z.enum(["template", "database"]),
}).omit({ userId: true, updatedAt: true, createdAt: true });

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const blockDeleteSchema = z.object({
	refs: z.array(blockUpdateSchema.pick({ id: true })),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Block = z.infer<typeof blockSelectSchema>;
export type BlockInsert = z.infer<typeof blockInsertSchema>;
export type BlockUpdate = z.infer<typeof blockUpdateSchema>;
export type BlockDelete = z.infer<typeof blockDeleteSchema>;

export type BlockConfigType =
	| z.infer<typeof templateBlockSchema>
	| z.infer<typeof databaseBlockSchema>;

export type BlockTypes = "template" | "database";

// Type-safe block variants
export type TemplateBlock = Block & {
	config: z.infer<typeof templateBlockSchema>;
};

export type DatabaseBlock = Block & {
	config: z.infer<typeof databaseBlockSchema>;
};

/**
 * ----------------
 * Type Guards
 * ----------------
 */

export function isTemplateBlock(block: Block): block is TemplateBlock {
	return block.config.type === "template";
}

export function isDatabaseBlock(block: Block): block is DatabaseBlock {
	return block.config.type === "database";
}
