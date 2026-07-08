import { z } from "zod/v4";
import { paginationInputSchema, zedTokenSchema } from "../shared";
import { createUniqueRefsInputSchema } from "../shared/ref-list";
import { bucketSchema } from "../storage/parts/buckets";
import { processingStatusSchema } from "./parts/processing-status";
import { assetIdSchema } from "./ref";
import {
	assetFieldsSchema,
	assetFiltersSchema,
	assetMutableFieldsSchema,
	finalizedUploadFileSchema,
} from "./schema";

export const listAssetsInputSchema = z.object({
	...paginationInputSchema.shape,
	...zedTokenSchema.shape,
	filters: assetFiltersSchema.optional(),
});

export const findAssetInputSchema = z.object({
	id: assetIdSchema,
	...zedTokenSchema.shape,
});

export const createAssetInputSchema = assetFieldsSchema.extend({
	id: assetIdSchema.optional(),
	metadata: assetFieldsSchema.shape.metadata.optional(),
	size: z.number().int(),
	processingStatus: processingStatusSchema.optional(),
	fileType: z.string(),
	bucket: bucketSchema.optional(),
});

export const updateAssetInputSchema = assetMutableFieldsSchema.extend({
	id: assetIdSchema,
	bucket: bucketSchema.optional(),
});

export const saveAssetInputSchema = z
	.object({
		id: assetIdSchema.optional(),
		title: z.string().min(1, "Title is required"),
		metadata: assetFieldsSchema.shape.metadata,
		upload: finalizedUploadFileSchema.optional(),
	})
	.check((ctx) => {
		if (!ctx.value.id && !ctx.value.upload) {
			ctx.issues.push({
				code: "custom",
				message: "Either an existing asset id or an uploaded file is required.",
				path: [
					"upload",
				],
				input: ctx.value,
			});
		}
	});

export const saveManyAssetsInputSchema = z.object({
	assets: z.array(saveAssetInputSchema).min(1),
});

export const deleteAssetsInputSchema = z.object({
	refs: createUniqueRefsInputSchema({
		key: "id",
		value: assetIdSchema,
		entityName: "asset",
	}),
});

export type ListAssetsInput = z.infer<typeof listAssetsInputSchema>;
export type FindAssetInput = z.infer<typeof findAssetInputSchema>;
export type CreateAssetInput = z.infer<typeof createAssetInputSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetInputSchema>;
export type SaveAssetInput = z.infer<typeof saveAssetInputSchema>;
export type SaveManyAssetsInput = z.infer<typeof saveManyAssetsInputSchema>;
export type DeleteAssetsInput = z.infer<typeof deleteAssetsInputSchema>;
