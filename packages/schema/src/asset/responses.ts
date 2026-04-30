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

export const createAssetResponseSchema = z.object({
	data: assetSchema,
	meta: zedTokenSchema.optional(),
});

export const saveAssetResponseSchema = z.object({
	data: assetSchema,
	meta: zedTokenSchema.optional(),
});

export const saveManyAssetsResponseSchema = z.object({
	data: z.array(assetSchema),
	meta: zedTokenSchema.optional(),
});

export const deleteAssetsResponseSchema = createDeleteResponseSchema();
