import { z } from "zod/v4";
import {
	blockResourceIdentitySchema,
	botResourceIdentitySchema,
} from "../resource/schema";
import { botIdSchema, organizationIdSchema } from "../shared/ids";
import { librarySortSchema } from "../shared/library";
import { paginationInputSchema } from "../shared/pagination";
import { zedTokenSchema } from "../shared/zed-token";

/** The kinds the catalogue lists; assets are published through their repository. */
export const catalogueKindSchema = z.enum([
	"bot",
	"behaviour",
	"repository",
]);

/**
 * Bots by the model their author's setup asks for: any, none ("works with
 * any model"), a recommended one ("tuned for") or a required one.
 */
const catalogueModelFilterSchema = z.enum([
	"any",
	"none",
	"recommended",
	"required",
]);

/** A catalogue entry: a listed bot or block. */
const catalogueEntryRefSchema = z.discriminatedUnion("resourceType", [
	botResourceIdentitySchema,
	blockResourceIdentitySchema,
]);

export const listCatalogueInputSchema = paginationInputSchema.extend({
	/** Every kind unless given. */
	kind: catalogueKindSchema.optional(),
	search: z.string().optional(),
	/** Entries from these organisations only; every organisation when empty. */
	organizationIds: z.array(organizationIdSchema).default([]),
	model: catalogueModelFilterSchema.default("any"),
	/** Leaves out what the active organisation's library already holds. */
	hideAdded: z.boolean().default(false),
	sort: librarySortSchema.default("newest"),
});

export const catalogueCountsInputSchema = z.object({
	search: z.string().optional(),
});

export const findCatalogueEntryInputSchema = z.object({
	...zedTokenSchema.shape,
	entry: catalogueEntryRefSchema,
});

export const addCatalogueEntryInputSchema = z.object({
	...zedTokenSchema.shape,
	entry: catalogueEntryRefSchema,
	/** Adds a bot's behaviour and repositories too; ignored for blocks. */
	withBlocks: z.boolean().default(false),
});

/** Adds the blocks of a bot the organisation added, not the bot itself. */
export const addCatalogueBotBlocksInputSchema = z.object({
	...zedTokenSchema.shape,
	botId: botIdSchema,
});

export const removeCatalogueEntryInputSchema = z.object({
	...zedTokenSchema.shape,
	entry: catalogueEntryRefSchema,
});

export type CatalogueKind = z.infer<typeof catalogueKindSchema>;
export type CatalogueModelFilter = z.infer<typeof catalogueModelFilterSchema>;
export type CatalogueEntryRef = z.infer<typeof catalogueEntryRefSchema>;
export type ListCatalogueInput = z.infer<typeof listCatalogueInputSchema>;
export type CatalogueCountsInput = z.infer<typeof catalogueCountsInputSchema>;
