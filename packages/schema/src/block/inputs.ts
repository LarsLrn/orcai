import { z } from "zod/v4";
import { assetIdSchema } from "../asset/ref";
import { botIdSchema } from "../bot/ref";
import { paginationInputSchema, zedTokenSchema } from "../shared";
import { publicationStatusSchema } from "../shared/primitives/publication-status";
import { blockIdSchema } from "./ref";
import {
	blockFieldsSchema,
	blockTypeSchema,
	contentJsonSchema,
	databaseBlockSchema,
	imageGenerationBlockSchema,
	templateBlockSchema,
} from "./schema";

const blockWriteFieldsSchema = blockFieldsSchema.extend({
	name: z.string().min(1, "Name is required"),
	description: blockFieldsSchema.shape.description.optional(),
	contentJson: contentJsonSchema.nullable().optional(),
	contentHtml: blockFieldsSchema.shape.contentHtml.optional(),
	forkedFromId: blockFieldsSchema.shape.forkedFromId.optional(),
	version: blockFieldsSchema.shape.version.optional(),
});

export const createTemplateBlockInputSchema = blockWriteFieldsSchema.extend(
	templateBlockSchema.shape,
);

export const createDatabaseBlockInputSchema = blockWriteFieldsSchema.extend({
	...databaseBlockSchema.shape,
	assets: z.array(assetIdSchema).default([]),
});

export const createImageGenerationBlockInputSchema =
	blockWriteFieldsSchema.extend(imageGenerationBlockSchema.shape);

export const createBlockInputSchema = z.discriminatedUnion("type", [
	createTemplateBlockInputSchema,
	createDatabaseBlockInputSchema,
	createImageGenerationBlockInputSchema,
]);

const updateBlockFieldsSchema = blockWriteFieldsSchema.extend({
	id: blockIdSchema,
});

export const updateTemplateBlockInputSchema = updateBlockFieldsSchema.extend(
	templateBlockSchema.shape,
);

export const updateDatabaseBlockInputSchema = updateBlockFieldsSchema.extend({
	...databaseBlockSchema.shape,
	assets: z.array(assetIdSchema).default([]),
});

export const updateImageGenerationBlockInputSchema =
	updateBlockFieldsSchema.extend(imageGenerationBlockSchema.shape);

export const updateBlockInputSchema = z.discriminatedUnion("type", [
	updateTemplateBlockInputSchema,
	updateDatabaseBlockInputSchema,
	updateImageGenerationBlockInputSchema,
]);

export const listBlocksInputSchema = paginationInputSchema.extend({
	...zedTokenSchema.shape,
	filters: z
		.object({
			botId: botIdSchema.optional(),
			type: blockTypeSchema.optional(),
			status: publicationStatusSchema.optional(),
		})
		.optional(),
});

export const findBlockInputSchema = z.object({
	id: blockIdSchema,
	...zedTokenSchema.shape,
});

export const deleteBlocksInputSchema = z.object({
	refs: z.array(
		z.object({
			id: blockIdSchema,
		}),
	),
});

export type ListBlocksInput = z.infer<typeof listBlocksInputSchema>;
export type CreateBlockInput = z.infer<typeof createBlockInputSchema>;
export type FindBlockInput = z.infer<typeof findBlockInputSchema>;
export type UpdateBlockInput = z.infer<typeof updateBlockInputSchema>;
export type DeleteBlocksInput = z.infer<typeof deleteBlocksInputSchema>;
