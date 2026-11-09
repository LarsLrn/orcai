import { z } from "zod/v4";
import { retrievalModeSchema } from "../shared/primitives/retrieval-mode";
import {
	assetPointBrowseCursorSchema,
	retrievedAssetPointSchema,
} from "./schema";

export const listAssetPointsResponseSchema = z.object({
	data: z.array(retrievedAssetPointSchema),
	metadata: z
		.object({
			retrievalMode: retrievalModeSchema,
			candidateCount: z.number().int().min(0),
			returnedCount: z.number().int().min(0),
		})
		.optional(),
});

/** Each search's answer, in the order of the searches. */
export const searchRepositoriesAssetPointsResponseSchema = z.object({
	results: z.array(listAssetPointsResponseSchema),
});

export const browseRepositoryAssetPointsResponseSchema = z.object({
	data: z.array(retrievedAssetPointSchema),
	/** Absent on the last page. */
	nextCursor: assetPointBrowseCursorSchema.nullable(),
});
