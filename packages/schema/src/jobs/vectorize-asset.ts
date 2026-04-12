import { z } from "zod/v4";

export const vectorizeAssetPayloadSchema = z.object({
	assetId: z.uuidv4(),
	blockId: z.uuidv4(),
});

export type VectorizeAssetPayload = z.infer<typeof vectorizeAssetPayloadSchema>;

export const vectorizeAssetOutputSchema = z.object({
	message: z.string().optional(),
});
