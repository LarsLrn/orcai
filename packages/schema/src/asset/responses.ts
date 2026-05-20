import { z } from "zod/v4";
import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
	zedTokenSchema,
} from "../shared";
import { assetSchema } from "./schema";

export const listAssetsResponseSchema = createListResponseSchema(assetSchema);

export const findAssetResponseSchema = createDataResponseSchema(assetSchema);

export const createAssetResponseSchema = createDataResponseSchema(
	assetSchema,
).extend({
	meta: zedTokenSchema.optional(),
});

export const saveAssetResponseSchema = createDataResponseSchema(
	assetSchema,
).extend({
	meta: zedTokenSchema.optional(),
});

export const saveManyAssetsResponseSchema = createDataResponseSchema(
	z.array(assetSchema),
).extend({
	meta: zedTokenSchema.optional(),
});

export const deleteAssetsResponseSchema = createDeleteResponseSchema();
