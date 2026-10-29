import { z } from "zod/v4";
import { assetIdSchema } from "../asset/ref";
import { blockIdSchema } from "../block/ref";
import { blockTypeSchema } from "../block/schema";
import { botSetupStrengthSchema } from "../bot-setup/schema";
import { modelIdSchema } from "../model/ref";
import {
	resourceOwnerSchema,
	sourceOrganizationSchema,
} from "../resource/schema";
import { createDataResponseSchema, createListResponseSchema } from "../shared";
import { catalogueKindSchema } from "./inputs";

/**
 * How the entry relates to the active organisation: its home, added from
 * the catalogue, or not in its library yet.
 */
export const catalogueEntryStateSchema = z.enum([
	"home",
	"added",
	"available",
]);

/** The model the author's setup asks for in the bot's home. */
export const catalogueModelHintSchema = z.object({
	strength: botSetupStrengthSchema,
	modelName: z.string(),
});

/** One catalogue tile. */
export const catalogueEntrySchema = z.object({
	kind: catalogueKindSchema,
	/** The bot or block id. */
	id: z.uuid(),
	name: z.string(),
	description: z.string().nullable(),
	createdAt: z.coerce.date().nullable(),
	source: sourceOrganizationSchema,
	owner: resourceOwnerSchema,
	state: catalogueEntryStateSchema,
	/** A bot's blocks; null for behaviours and repositories. */
	contents: z
		.object({
			behaviour: z.boolean(),
			repositories: z.number().int(),
		})
		.nullable(),
	/** A bot's model; null when it works with any model, and for blocks. */
	modelHint: catalogueModelHintSchema.nullable(),
	/** A repository's published documents; null for bots and behaviours. */
	documents: z.number().int().nullable(),
});

export const listCatalogueResponseSchema =
	createListResponseSchema(catalogueEntrySchema);

export const catalogueCountsResponseSchema = createDataResponseSchema(
	z.object({
		counts: z.record(catalogueKindSchema, z.number().int()),
		/** The organisations with entries, by name, with how many each lists. */
		organizations: z.array(
			sourceOrganizationSchema.extend({
				entries: z.number().int(),
			}),
		),
	}),
);

const catalogueBlockSummarySchema = z.object({
	id: blockIdSchema,
	name: z.string(),
	type: blockTypeSchema,
	description: z.string().nullable(),
	/** A repository's published documents; null for behaviours. */
	documents: z.number().int().nullable(),
});

/** What an entry's page shows to judge it before adding it. */
export const catalogueEntryDetailSchema = catalogueEntrySchema.extend({
	/** A bot's behaviour and repositories. */
	blocks: z.array(catalogueBlockSummarySchema),
	/**
	 * For a bot with a model hint: the active organisation's chat model with
	 * the same provider model, when it may use it.
	 */
	authorsPick: modelIdSchema.nullable(),
	/** A behaviour's prompt. */
	prompt: z.string().nullable(),
	/** A repository's first published documents. */
	documentPreview: z.array(
		z.object({
			id: assetIdSchema,
			title: z.string(),
		}),
	),
});

export const findCatalogueEntryResponseSchema = createDataResponseSchema(
	catalogueEntryDetailSchema,
);

export const installCatalogueEntryResponseSchema = createDataResponseSchema(
	z.object({
		/** False when the organisation had it already. */
		changed: z.boolean(),
	}),
);

export type CatalogueEntryState = z.infer<typeof catalogueEntryStateSchema>;
export type CatalogueEntry = z.infer<typeof catalogueEntrySchema>;
export type CatalogueEntryDetail = z.infer<typeof catalogueEntryDetailSchema>;
export type CatalogueCounts = z.infer<
	typeof catalogueCountsResponseSchema
>["data"];
