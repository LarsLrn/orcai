import { z } from "zod/v4";
import { assetSelectSchema } from "./asset";
import { databaseBlockSchema, templateBlockSchema } from "./block";
import { publicationStatusSchema } from "./fragments/publication-status";

const baseEditorBlockSchema = z.object({
	id: z.uuidv4().optional(),
	name: z.string().min(1, "Name is required"),
	status: publicationStatusSchema,
});

export const databaseBlockEditorSchema = baseEditorBlockSchema.extend({
	type: z.literal("database").default("database"),
	config: databaseBlockSchema.shape.config,
	assetIds: z.array(assetSelectSchema.shape.id).default([]),
	assets: z.array(assetSelectSchema).default([]),
});

export const botEditorSaveSchema = z.object({
	id: z.uuidv4().optional(),
	name: z.string().min(1, "Bot name is required"),
	description: z.string().min(1, "Bot description is required"),
	contentJson: z.json().default({}),
	contentHtml: z.string().default(""),
	status: publicationStatusSchema,
	templateBlock: baseEditorBlockSchema
		.extend({
			type: templateBlockSchema.shape.type.default("template"),
			config: templateBlockSchema.shape.config,
		})
		.nullable()
		.optional(),
	databaseBlocks: z.array(databaseBlockEditorSchema).default([]),
});

export const botEditorPublishSchema = z.object({
	id: z.uuidv4(),
});

export const botEditorFindSchema = z.object({
	id: z.uuidv4(),
});

export const botEditorSelectSchema = botEditorSaveSchema.extend({
	id: z.uuidv4(),
	status: publicationStatusSchema,
	templateBlock: baseEditorBlockSchema
		.extend({
			type: templateBlockSchema.shape.type.default("template"),
			config: templateBlockSchema.shape.config,
		})
		.nullable(),
	databaseBlocks: z.array(databaseBlockEditorSchema),
});

export type BotEditorSave = z.infer<typeof botEditorSaveSchema>;
export type BotEditorSelect = z.infer<typeof botEditorSelectSchema>;
