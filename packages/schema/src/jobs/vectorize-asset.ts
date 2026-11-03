import { z } from "zod/v4";
import {
	activityRunIdSchema,
	assetIdSchema,
	blockIdSchema,
} from "../shared/ids";

export const vectorizeAssetPayloadSchema = z.object({
	assetId: assetIdSchema,
	blockId: blockIdSchema,
	/** The link's indexing attempt the job was queued for. */
	attempt: z.number().int().nonnegative(),
	/** The activity run that admitted the work; none for automatic work. */
	runId: activityRunIdSchema.optional(),
});

export type VectorizeAssetPayload = z.infer<typeof vectorizeAssetPayloadSchema>;
