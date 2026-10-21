import { z } from "zod/v4";
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
	assetWithCapabilitiesSchema,
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
