import { z } from "zod/v4";
import { jobState } from "@/lib/pg-boss/schema/job";
import { assetSelectSchema } from "./asset";
import {
	blockStatusSchema,
	databaseBlockSchema,
	templateBlockSchema,
} from "./block";
import { botStatusSchema } from "./bot";

const baseEditorBlockSchema = z.object({
	id: z.uuidv4().optional(),
	name: z.string().min(1, "Name is required"),
	status: blockStatusSchema.optional(),
});

export const databaseBlockEditorSchema = baseEditorBlockSchema.extend({
	type: z.literal("database").default("database"),
	config: databaseBlockSchema.shape.config,
	assetIds: z.array(assetSelectSchema.shape.id).default([]),
	attachments: z
		.array(
			z.object({
				asset: assetSelectSchema,
				indexingStatus: jobState,
			}),
		)
		.default([]),
});

export const botEditorSaveSchema = z.object({
	id: z.uuidv4().optional(),
	name: z.string().min(1, "Bot name is required"),
	description: z.string().min(1, "Bot description is required"),
	contentJson: z.json().default({}),
	contentHtml: z.string().default(""),
	status: botStatusSchema.optional(),
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
	status: botStatusSchema,
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
