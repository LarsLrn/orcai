import { z } from "zod/v4";
import { blockIdSchema } from "../block/ref";
import { publicationStatusSchema } from "../fragments/publication-status";
import { paginationInputSchema, zedTokenSchema } from "../shared";
import { botIdSchema } from "./ref";
import { botContentJsonSchema, botFieldsSchema } from "./schema";

export const listBotsInputSchema = paginationInputSchema.extend({
	...zedTokenSchema.shape,
	search: z.string().optional(),
});

export const findBotInputSchema = z.object({
	id: botIdSchema,
	...zedTokenSchema.shape,
});

export const findBotEditorInputSchema = z.object({
	id: botIdSchema,
	...zedTokenSchema.shape,
});

export const saveBotInputSchema = z.object({
	...zedTokenSchema.shape,
	id: botIdSchema.optional(),
	name: botFieldsSchema.shape.name,
	description: botFieldsSchema.shape.description,
	contentJson: botContentJsonSchema.default({}),
	contentHtml: botFieldsSchema.shape.contentHtml.default(""),
	status: publicationStatusSchema,
	templateBlockId: blockIdSchema.nullable().default(null),
	databaseBlockIds: z.array(blockIdSchema).default([]),
});

export const publishBotInputSchema = z.object({
	id: botIdSchema,
});

export const listDraftBotsInputSchema = listBotsInputSchema;

export const deleteBotsInputSchema = z.object({
	refs: z.array(
		z.object({
			id: botIdSchema,
		}),
	),
});

export type ListBotsInput = z.infer<typeof listBotsInputSchema>;
export type FindBotInput = z.infer<typeof findBotInputSchema>;
export type FindBotEditorInput = z.infer<typeof findBotEditorInputSchema>;
export type SaveBotInput = z.infer<typeof saveBotInputSchema>;
export type PublishBotInput = z.infer<typeof publishBotInputSchema>;
export type ListDraftBotsInput = z.infer<typeof listDraftBotsInputSchema>;
export type DeleteBotsInput = z.infer<typeof deleteBotsInputSchema>;
