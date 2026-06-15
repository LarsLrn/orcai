import { z } from "zod/v4";
import { assetSchema } from "../asset/schema";
import { blockIdSchema } from "../block/ref";
import {
	blockFieldsSchema,
	databaseBlockSchema,
	templateBlockSchema,
} from "../block/schema";
import { publicationStatusSchema } from "../shared/primitives/publication-status";
import { userIdSchema } from "../user/ref";
import { botIdSchema } from "./ref";

export const botContentJsonSchema = z.custom<object>(
	(value) =>
		value !== null && typeof value === "object" && !Array.isArray(value),
);

export const botFieldsSchema = z.object({
	name: z.string().min(1, "Bot name is required"),
	description: z.string().min(1, "Bot description is required").max(500),
	contentJson: botContentJsonSchema,
	contentHtml: z.string(),
	status: publicationStatusSchema,
	forkedFromId: botIdSchema.nullable(),
	version: z.number().int(),
});

export const botMutableFieldsSchema = botFieldsSchema.partial();

export const botSchema = botFieldsSchema.extend({
	id: botIdSchema,
	userId: userIdSchema,
	createdAt: z.coerce.date().nullable(),
	updatedAt: z.coerce.date().nullable(),
});

export const botWithBlocksSchema = botSchema.extend({
	blockIds: z.array(blockIdSchema),
});

const botEditorBlockSchema = z.object({
	id: blockIdSchema,
	canEdit: z.boolean(),
	name: z.string().min(1, "Name is required"),
	description: blockFieldsSchema.shape.description,
	contentJson: blockFieldsSchema.shape.contentJson,
	contentHtml: blockFieldsSchema.shape.contentHtml,
	status: publicationStatusSchema,
});

export const botEditorTemplateBlockSchema = botEditorBlockSchema
	.extend({
		type: templateBlockSchema.shape.type.default("template"),
		config: templateBlockSchema.shape.config,
	})
	.nullable();

export const botEditorDatabaseBlockSchema = botEditorBlockSchema.extend({
	type: z.literal("database").default("database"),
	config: databaseBlockSchema.shape.config,
	assetIds: z.array(assetSchema.shape.id).default([]),
	assets: z.array(assetSchema).default([]),
});

export const botEditorSchema = z.object({
	id: botIdSchema,
	name: botFieldsSchema.shape.name,
	description: botFieldsSchema.shape.description,
	contentJson: botFieldsSchema.shape.contentJson.default({}),
	contentHtml: botFieldsSchema.shape.contentHtml.default(""),
	status: publicationStatusSchema,
	templateBlock: botEditorTemplateBlockSchema,
	databaseBlocks: z.array(botEditorDatabaseBlockSchema),
});

export type Bot = z.infer<typeof botSchema>;
export type BotWithBlocks = z.infer<typeof botWithBlocksSchema>;
export type BotEditor = z.infer<typeof botEditorSchema>;
