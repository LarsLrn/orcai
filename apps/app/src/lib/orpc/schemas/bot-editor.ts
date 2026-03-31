import { publicationStatusSchema } from "@orcai/schema";
import { z } from "zod/v4";
import { assetSelectSchema } from "./asset";
import {
	baseBlockSelectSchema,
	databaseBlockSchema,
	templateBlockSchema,
} from "./block";
import { zedTokenSchema } from "./shared";

const baseEditorBlockSchema = z.object({
	id: z.uuidv4(),
	canEdit: z.boolean(),
	name: z.string().min(1, "Name is required"),
	description: baseBlockSelectSchema.shape.description,
	contentJson: baseBlockSelectSchema.shape.contentJson,
	contentHtml: baseBlockSelectSchema.shape.contentHtml,
	status: publicationStatusSchema,
});

export const databaseBlockEditorSchema = baseEditorBlockSchema.extend({
	type: z.literal("database").default("database"),
	config: databaseBlockSchema.shape.config,
	assetIds: z.array(assetSelectSchema.shape.id).default([]),
	assets: z.array(assetSelectSchema).default([]),
});

export const botEditorSaveSchema = z.object({
	...zedTokenSchema.shape,
	id: z.uuidv4().optional(),
	name: z.string().min(1, "Bot name is required"),
	description: z.string().min(1, "Bot description is required"),
	contentJson: z.json().default({}),
	contentHtml: z.string().default(""),
	status: publicationStatusSchema,
	templateBlockId: z.uuidv4().nullable().default(null),
	databaseBlockIds: z.array(z.uuidv4()).default([]),
});

export const botEditorPublishSchema = z.object({
	id: z.uuidv4(),
});

export const botEditorFindSchema = z.object({
	id: z.uuidv4(),
	...zedTokenSchema.shape,
});

export const botEditorSelectSchema = z.object({
	id: z.uuidv4(),
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
		.nullable(),
	databaseBlocks: z.array(databaseBlockEditorSchema),
});

export type BotEditorSave = z.infer<typeof botEditorSaveSchema>;
export type BotEditorSelect = z.infer<typeof botEditorSelectSchema>;
