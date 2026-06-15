import { z } from "zod/v4";
import { publicationStatusSchema } from "../fragments/publication-status";
import { retrievalModeSchema } from "../fragments/retrieval-mode";
import { userIdSchema } from "../user/ref";
import { blockIdSchema } from "./ref";

export const contentJsonSchema = z.custom<object>(
	(value) =>
		value !== null && typeof value === "object" && !Array.isArray(value),
);

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

export const blockTypeSchema = z.enum([
	"template",
	"database",
	"imageGeneration",
]);

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
				path: [
					"maxReferences",
				],
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
				path: [
					"defaultReferences",
				],
				input: ctx.value,
			});
		}
	});

export const templateBlockSchema = z.object({
	type: z.literal("template"),
	config: z.object({
		systemPrompt: z.string(),
	}),
});

export const databaseBlockSchema = z.object({
	type: z.literal("database"),
	config: z.object({
		...referencesConfigSchema.shape,
		scoreThreshold: z.number().min(0).max(1).optional(),
		retrievalMode: retrievalModeSchema.optional(),
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

export const blockFieldsSchema = z.object({
	name: z.string(),
	description: z.string().max(500).nullable(),
	contentJson: contentJsonSchema.nullable(),
	contentHtml: z.string().nullable(),
	status: publicationStatusSchema,
	forkedFromId: blockIdSchema.nullable(),
	version: z.number().int(),
});

export const blockMutableFieldsSchema = blockFieldsSchema.partial();

const blockBaseSchema = blockFieldsSchema.extend({
	id: blockIdSchema,
	type: blockTypeSchema,
	config: z.unknown(),
	userId: userIdSchema,
	createdAt: z.coerce.date().nullable(),
	updatedAt: z.coerce.date().nullable(),
});

export const blockSchema = z.discriminatedUnion("type", [
	blockBaseSchema.extend(templateBlockSchema.shape),
	blockBaseSchema.extend(databaseBlockSchema.shape),
	blockBaseSchema.extend(imageGenerationBlockSchema.shape),
]);

export const blockWithPermissionsSchema = z.intersection(
	blockSchema,
	z.object({
		canEdit: z.boolean().optional(),
	}),
);

export type Block = z.infer<typeof blockSchema>;

export type BlockConfigType =
	| z.infer<typeof templateBlockSchema.shape.config>
	| z.infer<typeof databaseBlockSchema.shape.config>
	| z.infer<typeof imageGenerationBlockSchema.shape.config>;

export type BlockType = z.infer<typeof blockTypeSchema>;

export type TemplateBlock = Extract<
	Block,
	{
		type: "template";
	}
>;
export type DatabaseBlock = Extract<
	Block,
	{
		type: "database";
	}
>;
export type ImageGenerationBlock = Extract<
	Block,
	{
		type: "imageGeneration";
	}
>;

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
