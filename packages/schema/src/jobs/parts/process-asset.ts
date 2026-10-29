import { z } from "zod/v4";
import { activityRunIdSchema } from "../../activity/ref";
import { assetIdSchema } from "../../asset/ref";
import { fileTypeSchema } from "../../shared/primitives/file-type";
import { bucketSchema } from "../../storage/parts/buckets";

export const processAssetPayloadSchema = z.object({
	assetRef: z.object({
		bucket: bucketSchema,
		prefix: z.string(),
		id: assetIdSchema,
		type: fileTypeSchema,
	}),
	/** The asset's processing generation the job was queued for; jobs queued before generations existed stand for generation 0. */
	generation: z.number().int().nonnegative().optional(),
	/** The activity run that admitted the work; none for automatic work. */
	runId: activityRunIdSchema.optional(),
});

export type ProcessAssetPayload = z.infer<typeof processAssetPayloadSchema>;
