import { z } from "zod/v4";
import { assetWithCapabilitiesSchema } from "../asset/schema";
import { entityCapabilitiesSchema } from "../authorization/schema";
import {
	homeOrganizationSchema,
	resourceOwnerSchema,
} from "../resource/schema";
import { assetIdSchema, blockIdSchema } from "../shared/ids";
import {
	createDataResponseSchema,
	createListResponseSchema,
	statusResponseSchema,
} from "../shared/responses";
import {
	blockFieldsSchema,
	blockSchema,
	blockTypeSchema,
	blockWithCapabilitiesSchema,
	repositoryReadinessSchema,
	repositoryTotalsSchema,
} from "./schema";

/** A block as library lists return it: what its tile shows, without its content or settings. */
export const blockListItemSchema = z.object({
	id: blockIdSchema,
	type: blockTypeSchema,
	name: blockFieldsSchema.shape.name,
	description: blockFieldsSchema.shape.description,
	status: blockFieldsSchema.shape.status,
	createdAt: z.coerce.date().nullable(),
	capabilities: entityCapabilitiesSchema,
	owner: resourceOwnerSchema,
	/** Set when the active organisation added the block from the catalogue. */
	homeOrganization: homeOrganizationSchema.nullable(),
	/** A repository's asset counts; null for behaviours. */
	assets: repositoryTotalsSchema.nullable(),
});

export const listBlocksResponseSchema =
	createListResponseSchema(blockListItemSchema);

export const createBlockResponseSchema = createDataResponseSchema(
	blockSchema,
).extend({
	assets: z.array(assetIdSchema).optional(),
});

export const findBlockResponseSchema = createDataResponseSchema(
	z.intersection(
		blockWithCapabilitiesSchema,
		z.object({
			owner: resourceOwnerSchema,
			/** Set when the active organisation added the block from the catalogue. */
			homeOrganization: homeOrganizationSchema.nullable(),
		}),
	),
).extend({
	assets: z.array(assetWithCapabilitiesSchema).optional(),
});

export const updateBlockResponseSchema = createDataResponseSchema(
	blockSchema,
).extend({
	assets: z.array(assetIdSchema).optional(),
});

export const deleteBlocksResponseSchema = statusResponseSchema;

/** The readable repositories among the requested ones, in request order. */
export const blockReadinessResponseSchema = createDataResponseSchema(
	z.array(repositoryReadinessSchema),
);

/** Which stage the retry runs again: processing the file or indexing it here. */
export const prepareRepositoryAssetAgainResponseSchema = z.object({
	retried: z.enum([
		"processing",
		"indexing",
	]),
});

/** How many failed assets were queued again, by stage. */
export const prepareRepositoryFailedAgainResponseSchema = z.object({
	processing: z.number().int(),
	indexing: z.number().int(),
});

export type BlockListItem = z.infer<typeof blockListItemSchema>;
