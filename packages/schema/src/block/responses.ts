import { z } from "zod/v4";
import { assetSchema } from "../asset";
import { assetIdSchema } from "../asset/ref";
import {
	createDataResponseSchema,
	createListResponseSchema,
	statusResponseSchema,
	zedTokenSchema,
} from "../shared";
import { blockSchema, blockWithPermissionsSchema } from "./schema";

export const listBlocksResponseSchema = createListResponseSchema(
	blockWithPermissionsSchema,
);

export const createBlockResponseSchema = createDataResponseSchema(
	blockSchema,
).extend({
	assets: z.array(assetIdSchema).optional(),
	meta: zedTokenSchema.optional(),
});

export const findBlockResponseSchema = createDataResponseSchema(
	blockWithPermissionsSchema,
).extend({
	assets: z.array(assetSchema).optional(),
});

export const updateBlockResponseSchema = createDataResponseSchema(
	blockSchema,
).extend({
	assets: z.array(assetIdSchema).optional(),
});

export const deleteBlocksResponseSchema = statusResponseSchema;
