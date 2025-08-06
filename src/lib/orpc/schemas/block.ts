import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { blockTable } from "@/db/schema/block";
import { assetSelectSchema } from "./asset";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const templateBlockSchema = z.object({
	type: z.literal("template"),
	config: z.object({
		systemPrompt: z.string(),
		model: z.string(),
		provider: z.string(),
	}),
});

export const databaseBlockSchema = z.object({
	type: z.literal("database"),
	config: z.object({
		embeddingModel: z.string(),
	}),
});

export const baseBlockSelectSchema = createSelectSchema(blockTable);

export const blockSelectSchema = z.discriminatedUnion("type", [
	baseBlockSelectSchema.extend(templateBlockSchema.shape),
	baseBlockSelectSchema.extend(databaseBlockSchema.shape),
]);

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

const baseBlockInsertSchema = createInsertSchema(blockTable).omit({
	userId: true,
	createdAt: true,
	updatedAt: true,
	id: true,
});

/* export const templateBlockInsertSchema = baseBlockInsertSchema.extend({
	type: z.literal("template"),
	config: templateBlockSchema.shape.config,
});

export const databaseBlockInsertSchema = baseBlockInsertSchema.extend({
	type: z.literal("database"),
	config: databaseBlockSchema.shape.config,
	assets: z
		.array(z.string())
		.min(1, "At least one asset is required for database blocks"),
}); */

export const blockInsertSchema = z.discriminatedUnion("type", [
	baseBlockInsertSchema.extend(templateBlockSchema.shape),
	baseBlockInsertSchema.extend({
		...databaseBlockSchema.shape,
		assets: z
			.array(assetSelectSchema.shape.id)
			.min(1, "At least one asset is required for database blocks"),
	}),
]);

/**
 * ----------------
 * Update Schema
 * ----------------
 */

const baseBlockUpdateSchema = createUpdateSchema(blockTable, {
	id: z.uuidv4(),
}).omit({
	userId: true,
	createdAt: true,
	updatedAt: true,
});

/* export const blockUpdateSchema = z.discriminatedUnion("type", [
	baseBlockUpdateSchema.extend({
		type: z.literal("template"),
		config: templateBlockSchema.shape.config,
	}),
	baseBlockUpdateSchema.extend({
		type: z.literal("database"),
		config: databaseBlockSchema.shape.config,
		assets: z
			.array(z.string())
			.min(1, "At least one asset is required for database blocks"),
	}),
]); */

export const blockUpdateSchema = z.discriminatedUnion("type", [
	baseBlockUpdateSchema.extend(templateBlockSchema.shape),
	baseBlockUpdateSchema.extend({
		...databaseBlockSchema.shape,
		assets: z
			.array(z.string())
			.min(1, "At least one asset is required for database blocks"),
	}),
]);

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const blockDeleteSchema = z.object({
	refs: z.array(baseBlockSelectSchema.pick({ id: true })),
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
	| z.infer<typeof templateBlockSchema.shape.config>
	| z.infer<typeof databaseBlockSchema.shape.config>;

// export type BlockTypes = "template" | "database";

// Type-safe block variants
export type TemplateBlock = Extract<Block, { type: "template" }>;
export type DatabaseBlock = Extract<Block, { type: "database" }>;

/**
 * ----------------
 * Type Guards
 * ----------------
 */

export function isTemplateBlock(block: Block): block is TemplateBlock {
	return block.type === "template";
}

export function isDatabaseBlock(block: Block): block is DatabaseBlock {
	return block.type === "database";
}
