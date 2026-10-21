import { z } from "zod/v4";
import { retrievalModeSchema } from "../shared/primitives/retrieval-mode";
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
