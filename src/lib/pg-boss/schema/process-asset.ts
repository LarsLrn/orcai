import { z } from "zod/v4";
import { assetSelectSchema } from "@/lib/orpc/schemas/asset";
import { baseBlockSelectSchema } from "@/lib/orpc/schemas/block";
import { fileTypeSchema } from "@/lib/s3/schema/file-schema";
import { bucketSchema } from "@/settings/buckets";

export const processAssetPayloadSchema = z.object({
	assetRef: z.object({
		bucket: bucketSchema,
		prefix: z.string(),
		id: assetSelectSchema.shape.id,
		type: fileTypeSchema,
	}),
	blockId: baseBlockSelectSchema.shape.id,
	mergePages: z.boolean(),
});

export type ProcessAssetPayload = z.infer<typeof processAssetPayloadSchema>;

export const processAssetOutputSchema = z.object({
	message: z.string(),
});
