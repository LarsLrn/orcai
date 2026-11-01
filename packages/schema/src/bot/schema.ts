import { z } from "zod/v4";
import { assetSchema, assetWithCapabilitiesSchema } from "../asset/schema";
import { entityCapabilitiesSchema } from "../authorization";
import { blockIdSchema } from "../block/ref";
import {
	blockFieldsSchema,
	databaseBlockSchema,
	templateBlockSchema,
} from "../block/schema";
import { botSetupStrengthSchema } from "../bot-setup/schema";
import { featuresSchema } from "../feature/schema";
import {
	resourceOwnerSchema,
	sourceOrganizationSchema,
} from "../resource/schema";
import { publicationStatusSchema } from "../shared/primitives/publication-status";
import { userIdSchema } from "../user/ref";
import { botIdSchema } from "./ref";

export const botContentJsonSchema = z.custom<object>(
	(value) =>
		value !== null && typeof value === "object" && !Array.isArray(value),
);

export const botFieldsSchema = z.object({
	name: z.string().min(1),
	description: z.string().min(1).max(500),
	contentJson: botContentJsonSchema,
	status: publicationStatusSchema,
	forkedFromId: botIdSchema.nullable(),
	version: z.number().int(),
	features: featuresSchema,
});

export const botMutableFieldsSchema = botFieldsSchema.partial();

export const botSchema = botFieldsSchema.extend({
	id: botIdSchema,
	userId: userIdSchema,
	createdAt: z.coerce.date().nullable(),
	updatedAt: z.coerce.date().nullable(),
});

export const botWithCapabilitiesSchema = botSchema.extend({
	capabilities: entityCapabilitiesSchema,
	isFavourite: z.boolean(),
});

/** A bot as library lists return it: with what its tile shows. */
export const botListItemSchema = botWithCapabilitiesSchema.extend({
	owner: resourceOwnerSchema,
	/** Set when the active organisation added the bot from the catalogue. */
	installedFrom: sourceOrganizationSchema.nullable(),
	contents: z.object({
		behaviour: z.boolean(),
		repositories: z.number().int(),
	}),
	/** The model the active organisation's setup asks for, if any. */
	modelHint: z
		.object({
			strength: botSetupStrengthSchema,
			modelName: z.string(),
		})
		.nullable(),
});

export const botWithBlocksSchema = botSchema.extend({
	blockIds: z.array(blockIdSchema),
	capabilities: entityCapabilitiesSchema,
	isFavourite: z.boolean(),
});

const botEditorBlockSchema = z.object({
	id: blockIdSchema,
	capabilities: entityCapabilitiesSchema,
	name: z.string().min(1),
	description: blockFieldsSchema.shape.description,
	contentJson: blockFieldsSchema.shape.contentJson,
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
	assets: z.array(assetWithCapabilitiesSchema).default([]),
});

export const botEditorSchema = z.object({
	id: botIdSchema,
	name: botFieldsSchema.shape.name,
	description: botFieldsSchema.shape.description,
	contentJson: botFieldsSchema.shape.contentJson.default({}),
	status: publicationStatusSchema,
	templateBlock: botEditorTemplateBlockSchema,
	databaseBlocks: z.array(botEditorDatabaseBlockSchema),
	features: featuresSchema.default({}),
	capabilities: entityCapabilitiesSchema,
});

export type Bot = z.infer<typeof botSchema>;
export type BotWithCapabilities = z.infer<typeof botWithCapabilitiesSchema>;
export type BotListItem = z.infer<typeof botListItemSchema>;
export type BotWithBlocks = z.infer<typeof botWithBlocksSchema>;
export type BotEditor = z.infer<typeof botEditorSchema>;
