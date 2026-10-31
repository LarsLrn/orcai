import { z } from "zod/v4";
import { activityRunIdSchema } from "../../activity/ref";
import { assetIdSchema } from "../../asset/ref";
import { userIdSchema } from "../../user/ref";

/**
 * `apply` fills empty fields and keeps only what it could not apply for
 * review; `review` keeps the whole suggestion for the person who asked.
 */
export const metadataGenerationModeSchema = z.enum([
	"apply",
	"review",
]);

export type MetadataGenerationMode = z.infer<
	typeof metadataGenerationModeSchema
>;

export const generateAssetMetadataPayloadSchema = z.object({
	assetId: assetIdSchema,
	/** Whose quota the call is metered against. */
	userId: userIdSchema,
	/** The asset's metadata generation the job was queued for. */
	generation: z.number().int().nonnegative(),
	mode: metadataGenerationModeSchema,
	/** The activity run that admitted the work; none for automatic work. */
	runId: activityRunIdSchema.optional(),
	/** Set once the generation had the file prepared again for a missing extraction. */
	preparedAgain: z.literal(true).optional(),
});

export type GenerateAssetMetadataPayload = z.infer<
	typeof generateAssetMetadataPayloadSchema
>;
