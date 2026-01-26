import { z } from "zod/v4";
import { assetSelectSchema } from "@/lib/orpc/schemas/asset";
import { baseBlockSelectSchema } from "@/lib/orpc/schemas/block";

export const vectorizeAssetPayloadSchema = z.object({
	prefix: z.string(),
	assetId: assetSelectSchema.shape.id,
	blockId: baseBlockSelectSchema.shape.id,
	mergePages: z.boolean(),
});

export type VectorizeAssetPayload = z.infer<typeof vectorizeAssetPayloadSchema>;

export const vectorizeAssetOutputSchema = z.object({
	message: z.string().optional(),
});
