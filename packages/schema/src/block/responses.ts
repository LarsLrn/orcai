import { z } from "zod/v4";
import { assetIdSchema } from "../asset/ref";
import { assetWithCapabilitiesSchema } from "../asset/schema";
import {
	createDataResponseSchema,
	createListResponseSchema,
	statusResponseSchema,
} from "../shared";
import {
	blockSchema,
	blockWithCapabilitiesSchema,
	repositoryReadinessSchema,
} from "./schema";

export const listBlocksResponseSchema = createListResponseSchema(
	blockWithCapabilitiesSchema,
);

export const createBlockResponseSchema = createDataResponseSchema(
	blockSchema,
).extend({
	assets: z.array(assetIdSchema).optional(),
});

export const findBlockResponseSchema = createDataResponseSchema(
	blockWithCapabilitiesSchema,
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
