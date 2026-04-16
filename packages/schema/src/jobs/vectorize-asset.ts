import { z } from "zod/v4";
import { assetIdSchema } from "../asset";
import { blockIdSchema } from "../block";

export const vectorizeAssetPayloadSchema = z.object({
	assetId: assetIdSchema,
	blockId: blockIdSchema,
});

export type VectorizeAssetPayload = z.infer<typeof vectorizeAssetPayloadSchema>;

export const vectorizeAssetOutputSchema = z.object({
	message: z.string().optional(),
});
