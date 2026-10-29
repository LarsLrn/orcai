import { z } from "zod/v4";
import { assetIdSchema } from "../asset/ref";
import { assetWithCapabilitiesSchema } from "../asset/schema";
import { resourceOwnerSchema } from "../resource/schema";
import {
	createDataResponseSchema,
	createListResponseSchema,
	statusResponseSchema,
} from "../shared";
import {
	blockSchema,
	blockWithCapabilitiesSchema,
	repositoryReadinessSchema,
	repositoryTotalsSchema,
} from "./schema";

/** A block as library lists return it: with what its tile shows. */
export const blockListItemSchema = z.intersection(
	blockWithCapabilitiesSchema,
	z.object({
		owner: resourceOwnerSchema,
		/** A repository's document counts; null for behaviours. */
		documents: repositoryTotalsSchema.nullable(),
	}),
);

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
export const retryDocumentResponseSchema = z.object({
	retried: z.enum([
		"processing",
		"indexing",
	]),
});

/** How many failed documents were queued again, by stage. */
export const retryFailedDocumentsResponseSchema = z.object({
	processing: z.number().int(),
	indexing: z.number().int(),
});

export type BlockListItem = z.infer<typeof blockListItemSchema>;
