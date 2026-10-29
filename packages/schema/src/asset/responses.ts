import { z } from "zod/v4";
import { resourceOwnerSchema } from "../resource/schema";
import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
	statusResponseSchema,
} from "../shared";
import { errorReasonSchema } from "../shared/error-reason";
import { assetSchema, assetWithCapabilitiesSchema } from "./schema";

export const listAssetsResponseSchema = createListResponseSchema(
	assetWithCapabilitiesSchema,
);

export const findAssetResponseSchema = createDataResponseSchema(
	assetWithCapabilitiesSchema.extend({
		/** The organisation the asset belongs to; null unless the user can read it. */
		organizationId: z.string().nullable(),
		/** Whether that organisation has a utility model to generate metadata with; null unless the user can read it. */
		utilityModel: z.boolean().nullable(),
		owner: resourceOwnerSchema,
	}),
);

export const saveAssetResponseSchema = createDataResponseSchema(assetSchema);

/** One uploaded file's outcome, keyed by the `objectKey` its upload was signed with. */
export const assetIntakeResultSchema = z.discriminatedUnion("status", [
	z.object({
		status: z.literal("created"),
		objectKey: z.string(),
		asset: assetSchema,
	}),
	z.object({
		status: z.literal("failed"),
		objectKey: z.string(),
		reason: errorReasonSchema,
		params: z.record(z.string(), z.unknown()).optional(),
	}),
]);

/** Results in input order. */
export const createAssetsFromUploadsResponseSchema = createDataResponseSchema(
	z.array(assetIntakeResultSchema),
);

export const deleteAssetsResponseSchema = createDeleteResponseSchema();

export type AssetIntakeResult = z.infer<typeof assetIntakeResultSchema>;

export const reprocessAssetResponseSchema = statusResponseSchema;

/** Library assets the user can edit whose metadata was never generated, or failed. */
export const missingMetadataResponseSchema = z.object({
	count: z.number().int().min(0),
});
