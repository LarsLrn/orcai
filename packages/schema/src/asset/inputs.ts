import { z } from "zod/v4";
import { paginationInputSchema, zedTokenSchema } from "../shared";
import { createUniqueRefsInputSchema } from "../shared/ref-list";
import {
	storageUploadRouteSchema,
	uploadFileObjectSchema,
} from "../storage/schema";
import { assetIdSchema } from "./ref";
import { assetFieldsSchema, assetFiltersSchema } from "./schema";

export const listAssetsInputSchema = z.object({
	...paginationInputSchema.shape,
	...zedTokenSchema.shape,
	filters: assetFiltersSchema.optional(),
});

export const findAssetInputSchema = z.object({
	id: assetIdSchema,
	...zedTokenSchema.shape,
});

export const saveAssetInputSchema = assetFieldsSchema.extend({
	id: assetIdSchema,
});

export const addAssetToLibraryInputSchema = z.object({
	id: assetIdSchema,
});

export const createAssetsFromUploadsInputSchema = z.object({
	route: storageUploadRouteSchema,
	files: z.array(uploadFileObjectSchema).min(1),
});

export const deleteAssetsInputSchema = z.object({
	refs: createUniqueRefsInputSchema({
		key: "id",
		value: assetIdSchema,
	}),
});

export type ListAssetsInput = z.infer<typeof listAssetsInputSchema>;
export type FindAssetInput = z.infer<typeof findAssetInputSchema>;
export type SaveAssetInput = z.infer<typeof saveAssetInputSchema>;
export type AddAssetToLibraryInput = z.infer<
	typeof addAssetToLibraryInputSchema
>;
export type CreateAssetsFromUploadsInput = z.infer<
	typeof createAssetsFromUploadsInputSchema
>;
export type DeleteAssetsInput = z.infer<typeof deleteAssetsInputSchema>;

export const reprocessAssetInputSchema = z.object({
	id: assetIdSchema,
});

export type ReprocessAssetInput = z.infer<typeof reprocessAssetInputSchema>;
