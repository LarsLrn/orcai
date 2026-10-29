import { z } from "zod/v4";
import { activityRunIdSchema } from "../../activity/ref";
import { assetIdSchema } from "../../asset/ref";
import { blockIdSchema } from "../../block/ref";

export const vectorizeAssetPayloadSchema = z.object({
	assetId: assetIdSchema,
	blockId: blockIdSchema,
	/** The link's indexing attempt the job was queued for; jobs queued before attempts existed stand for attempt 0. */
	attempt: z.number().int().nonnegative().optional(),
	/** The activity run that admitted the work; none for automatic work. */
	runId: activityRunIdSchema.optional(),
});

export type VectorizeAssetPayload = z.infer<typeof vectorizeAssetPayloadSchema>;
