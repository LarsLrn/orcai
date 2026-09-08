import { z } from "zod/v4";
import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
} from "../shared";
import { assetSchema, assetWithCapabilitiesSchema } from "./schema";

export const listAssetsResponseSchema = createListResponseSchema(
	assetWithCapabilitiesSchema,
);

export const findAssetResponseSchema = createDataResponseSchema(
	assetWithCapabilitiesSchema,
);

export const createAssetResponseSchema = createDataResponseSchema(assetSchema);

export const saveAssetResponseSchema = createDataResponseSchema(assetSchema);

export const saveManyAssetsResponseSchema = createDataResponseSchema(
	z.array(assetSchema),
);

export const deleteAssetsResponseSchema = createDeleteResponseSchema();
