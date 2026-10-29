import { z } from "zod/v4";
import { botIdSchema } from "../bot/ref";
import { organizationIdSchema } from "../organization/ref";
import {
	blockResourceIdentitySchema,
	botResourceIdentitySchema,
} from "../resource/schema";
import { paginationInputSchema, zedTokenSchema } from "../shared";
import { librarySortSchema } from "../shared/library";

/** The kinds the catalogue lists; documents are published through their repository. */
export const catalogueKindSchema = z.enum([
	"bot",
	"behaviour",
	"repository",
]);

/**
 * Bots by the model their author's setup asks for: any, none ("works with
 * any model"), a recommended one ("tuned for") or a required one.
 */
export const catalogueModelFilterSchema = z.enum([
	"any",
	"none",
	"recommended",
	"required",
]);

/** A catalogue entry: a listed bot or block. */
export const catalogueEntryRefSchema = z.discriminatedUnion("resourceType", [
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

export const installCatalogueEntryInputSchema = z.object({
	...zedTokenSchema.shape,
	entry: catalogueEntryRefSchema,
	/** Adds a bot's behaviour and repositories too; ignored for blocks. */
	withBlocks: z.boolean().default(false),
});

/** Adds the blocks of a bot the organisation added, not the bot itself. */
export const installCatalogueBotBlocksInputSchema = z.object({
	...zedTokenSchema.shape,
	botId: botIdSchema,
});

export const uninstallCatalogueEntryInputSchema = z.object({
	...zedTokenSchema.shape,
	entry: catalogueEntryRefSchema,
});

export type CatalogueKind = z.infer<typeof catalogueKindSchema>;
export type CatalogueModelFilter = z.infer<typeof catalogueModelFilterSchema>;
export type CatalogueEntryRef = z.infer<typeof catalogueEntryRefSchema>;
export type ListCatalogueInput = z.infer<typeof listCatalogueInputSchema>;
export type CatalogueCountsInput = z.infer<typeof catalogueCountsInputSchema>;
export type FindCatalogueEntryInput = z.infer<
	typeof findCatalogueEntryInputSchema
>;
export type InstallCatalogueEntryInput = z.infer<
	typeof installCatalogueEntryInputSchema
>;
export type InstallCatalogueBotBlocksInput = z.infer<
	typeof installCatalogueBotBlocksInputSchema
>;
export type UninstallCatalogueEntryInput = z.infer<
	typeof uninstallCatalogueEntryInputSchema
>;
