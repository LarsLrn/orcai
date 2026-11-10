import { z } from "zod/v4";
import { activityRunIdSchema, assetIdSchema } from "../shared/ids";
import { fileTypeSchema } from "../shared/primitives/file-type";
import { bucketSchema } from "../storage/schema";

export const processAssetPayloadSchema = z.object({
	assetRef: z.object({
		bucket: bucketSchema,
		prefix: z.string(),
		id: assetIdSchema,
		type: fileTypeSchema,
	}),
	/** The asset's processing generation the job was queued for. */
	generation: z.number().int().nonnegative(),
	/** The activity run that admitted the work; none for automatic work. */
	runId: activityRunIdSchema.optional(),
	/** An instance admin's run: model calls past the uploader's quota still run, and are recorded. */
	allowOverBudget: z.boolean().optional(),
});

export type ProcessAssetPayload = z.infer<typeof processAssetPayloadSchema>;
