import { z } from "zod/v4";
import { assetIdSchema } from "../asset";
import { blockIdSchema } from "../block";
import { retrievalModeSchema } from "../zod/retrieval";
import { assetPointPayloadSchema, assetPointSchema } from "./schema";

export const listAssetPointsInputSchema = z.object({
	filters: z.object({
		queries: z.array(z.string()).optional(),
		pointIds: z.array(assetPointSchema.shape.id).optional(),
		assetIds: z.array(assetPointSchema.shape.id).optional(),
		limit: z.number().int().min(1).optional(),
		blockId: blockIdSchema.optional(),
		minScore: z.number().min(0).max(1).optional(),
		retrievalMode: retrievalModeSchema.optional(),
		candidateLimit: z.number().int().min(1).max(200).optional(),
		denseWeight: z.number().min(0).max(1).optional(),
		lexicalWeight: z.number().min(0).max(1).optional(),
		maxPerAsset: z.number().int().min(1).optional(),
		page: z.number().int().min(1).optional(),
		pageFrom: z.number().int().min(1).optional(),
		pageTo: z.number().int().min(1).optional(),
		chunkIndices: z.array(z.number().int().min(0)).optional(),
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
