import { z } from "zod/v4";
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
});

export type ProcessAssetPayload = z.infer<typeof processAssetPayloadSchema>;

export const processAssetOutputSchema = z.object({
	message: z.string().optional(),
});
