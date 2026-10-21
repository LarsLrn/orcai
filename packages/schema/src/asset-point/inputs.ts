import { z } from "zod/v4";
import { assetIdSchema } from "../asset/ref";
import { blockIdSchema } from "../block/ref";
import { assetPointsFiltersSchema } from "./schema";

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

export type ListAssetPointsInput = z.infer<typeof listAssetPointsInputSchema>;
export type SearchRepositoryAssetPointsInput = z.infer<
	typeof searchRepositoryAssetPointsInputSchema
>;
