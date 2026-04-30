import { z } from "zod/v4";
import {
	createDataResponseSchema,
	createDeleteResponseSchema,
} from "../shared";
import { retrievalModeSchema } from "../zod/retrieval";
import { assetPointSchema } from "./schema";

export const listAssetPointsResponseSchema = z.object({
	data: z.array(assetPointSchema),
	metadata: z
		.object({
			retrievalMode: retrievalModeSchema,
			scoreThreshold: z.number().min(0).max(1),
			candidateCount: z.number().int().min(0),
			returnedCount: z.number().int().min(0),
		})
		.optional(),
});

export const findAssetPointResponseSchema =
	createDataResponseSchema(assetPointSchema);

export const createAssetPointResponseSchema =
	createDataResponseSchema(assetPointSchema);

export const updateAssetPointResponseSchema =
	createDataResponseSchema(assetPointSchema);

export const deleteAssetPointResponseSchema = createDeleteResponseSchema();
