import { z } from "zod/v4";
import { assetIdSchema } from "../asset/ref";
import {
	assetPointPayloadSchema,
	assetPointSchema,
	assetPointsFiltersSchema,
} from "./schema";

export const listAssetPointsInputSchema = z.object({
	filters: assetPointsFiltersSchema,
});

export const findAssetPointInputSchema = assetPointSchema.pick({
	id: true,
});

export const createAssetPointInputSchema = z.object({
	payload: assetPointPayloadSchema,
	vector: assetPointSchema.pick({
		vector: true,
	}),
});

export const updateAssetPointInputSchema = createAssetPointInputSchema.extend({
	id: assetPointSchema.shape.id,
});

export const deleteAssetPointInputSchema = z.object({
	assetId: assetIdSchema,
	refs: z.array(
		assetPointSchema.pick({
			id: true,
		}),
	),
});

export type CreateAssetPointInput = z.infer<typeof createAssetPointInputSchema>;
export type DeleteAssetPointInput = z.infer<typeof deleteAssetPointInputSchema>;
export type FindAssetPointInput = z.infer<typeof findAssetPointInputSchema>;
export type ListAssetPointsInput = z.infer<typeof listAssetPointsInputSchema>;
export type UpdateAssetPointInput = z.infer<typeof updateAssetPointInputSchema>;
