import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { dbSchema } from "@/db/schema";
import { assetSelectSchema } from "./asset";

/**
 * ----------------
 * Utility
 * ----------------
 */

export const BLOCK_TYPES = [
	{
		label: "Template",
		value: "template",
	},
	{
		label: "Database",
		value: "database",
	},
	{
		label: "Image Generation",
		value: "imageGeneration",
	},
] as const;

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const referencesConfigSchema = z
	.object({
		minReferences: z.number().int().min(1),
		maxReferences: z.number().int().min(1),
		defaultReferences: z.number().int().min(1),
	})
	.check((ctx) => {
		if (ctx.value.maxReferences < ctx.value.minReferences) {
			ctx.issues.push({
				code: "custom",
				message: "maxReferences cannot be less than minReferences",
				path: ["maxReferences"],
				input: ctx.value,
			});
		}
		if (
			ctx.value.defaultReferences < ctx.value.minReferences ||
			ctx.value.defaultReferences > ctx.value.maxReferences
		) {
			ctx.issues.push({
				code: "custom",
				message:
					"defaultReferences must be between minReferences and maxReferences",
				path: ["defaultReferences"],
				input: ctx.value,
			});
		}
	});

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
		provider: z.string(),
		embeddingModel: z.string(),
		...referencesConfigSchema.shape,
		scoreThreshold: z.number().min(0).max(1).optional(),
		retrievalMode: z.enum(["dense", "hybrid"]).optional(),
		candidateLimit: z.number().int().min(1).max(200).optional(),
		maxPerAsset: z.number().int().min(1).optional(),
	}),
});

export const imageGenerationBlockSchema = z.object({
	type: z.literal("imageGeneration"),
	config: z.object({
		provider: z.string(),
		model: z.string(),
		prompt: z.string().optional(),
	}),
});

export const baseBlockSelectSchema = createSelectSchema(dbSchema.block);

export const blockSelectSchema = z.discriminatedUnion("type", [
	baseBlockSelectSchema.extend(templateBlockSchema.shape),
	baseBlockSelectSchema.extend(databaseBlockSchema.shape),
	baseBlockSelectSchema.extend(imageGenerationBlockSchema.shape),
]);

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

const baseBlockInsertSchema = createInsertSchema(dbSchema.block).omit({
	userId: true,
	createdAt: true,
	updatedAt: true,
	id: true,
});

export const templateBlockInsertSchema = baseBlockInsertSchema.extend(
	templateBlockSchema.shape,
);

export const databaseBlockInsertSchema = baseBlockInsertSchema.extend({
	...databaseBlockSchema.shape,
	assets: z
		.array(assetSelectSchema.shape.id)
		.min(1, "At least one asset is required for database blocks"),
});

export const imageGenerationBlockInsertSchema = baseBlockInsertSchema.extend(
	imageGenerationBlockSchema.shape,
);

export const blockInsertSchema = z.discriminatedUnion("type", [
	templateBlockInsertSchema,
	databaseBlockInsertSchema,
	imageGenerationBlockInsertSchema,
]);

/**
 * ----------------
 * Update Schema
 * ----------------
 */

const baseBlockUpdateSchema = createUpdateSchema(dbSchema.block, {
	id: z.uuidv4(),
}).omit({
	userId: true,
	createdAt: true,
	updatedAt: true,
});

export const blockUpdateSchema = z.discriminatedUnion("type", [
	baseBlockUpdateSchema.extend(templateBlockSchema.shape),
	baseBlockUpdateSchema.extend({
		...databaseBlockSchema.shape,
		assets: z
			.array(z.string())
			.min(1, "At least one asset is required for database blocks"),
	}),
	baseBlockUpdateSchema.extend(imageGenerationBlockSchema.shape),
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
	| z.infer<typeof databaseBlockSchema.shape.config>
	| z.infer<typeof imageGenerationBlockSchema.shape.config>;

export type BlockType = "template" | "database" | "imageGeneration";

// Type-safe block variants
export type TemplateBlock = Extract<Block, { type: "template" }>;
export type DatabaseBlock = Extract<Block, { type: "database" }>;
export type ImageGenerationBlock = Extract<Block, { type: "imageGeneration" }>;

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

export function isImageGenerationBlock(
	block: Block,
): block is ImageGenerationBlock {
	return block.type === "imageGeneration";
}
