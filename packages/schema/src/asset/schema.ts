import { z } from "zod/v4";
import { bucketSchema } from "../storage/parts/buckets";
import { userIdSchema } from "../user/ref";
import { metadataSchema } from "./parts/metadata";
import { processingStatusSchema } from "./parts/processing-status";
import { assetIdSchema } from "./ref";

export const assetFieldsSchema = z.object({
	title: z.string().min(1, "Title is required"),
	metadata: metadataSchema,
});

export const assetMutableFieldsSchema = assetFieldsSchema.partial();

export const assetSchema = assetFieldsSchema.extend({
	id: assetIdSchema,
	bucket: bucketSchema,
	prefix: z.string(),
	size: z.number().int(),
	processingStatus: processingStatusSchema,
	fileType: z.string(),
	userId: userIdSchema,
	createdAt: z.coerce.date().nullable(),
	updatedAt: z.coerce.date().nullable(),
});

export const assetFiltersSchema = z.object({
	ids: z.array(assetIdSchema).optional(),
	search: z.string().optional(),
});

/**
 * Describes a file that has been uploaded to storage and is ready to be
 * persisted as an asset. Used in the save/finalize upload flow.
 */
export const finalizedUploadFileSchema = z.object({
	id: assetIdSchema,
	bucket: bucketSchema,
	prefix: z.string(),
	objectKey: z.string(),
	name: z.string(),
	size: z.number().int().min(1),
	type: z.string().min(1),
});

export type Asset = z.infer<typeof assetSchema>;
export type FinalizedUploadFile = z.infer<typeof finalizedUploadFileSchema>;
