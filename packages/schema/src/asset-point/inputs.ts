import { z } from "zod/v4";
import { assetIdSchema } from "../asset/ref";
import { blockIdSchema } from "../block/ref";
import { createUniqueRefsInputSchema } from "../shared/ref-list";
import {
	assetPointPayloadSchema,
	assetPointSchema,
	assetPointsFiltersSchema,
} from "./schema";

export const listAssetPointsInputSchema = z.object({
	assetId: assetIdSchema,
	filters: assetPointsFiltersSchema.omit({
		assetIds: true,
		blockId: true,
	}),
});

export const searchRepositoryAssetPointsInputSchema = z.object({
	repositoryId: blockIdSchema,
	filters: assetPointsFiltersSchema.omit({
		blockId: true,
	}),
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
	refs: createUniqueRefsInputSchema({
		key: "id",
		value: assetPointSchema.shape.id,
		entityName: "asset point",
	}),
});

export type CreateAssetPointInput = z.infer<typeof createAssetPointInputSchema>;
export type DeleteAssetPointInput = z.infer<typeof deleteAssetPointInputSchema>;
export type FindAssetPointInput = z.infer<typeof findAssetPointInputSchema>;
export type ListAssetPointsInput = z.infer<typeof listAssetPointsInputSchema>;
export type SearchRepositoryAssetPointsInput = z.infer<
	typeof searchRepositoryAssetPointsInputSchema
>;
export type UpdateAssetPointInput = z.infer<typeof updateAssetPointInputSchema>;
