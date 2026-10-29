import { z } from "zod/v4";
import { paginationInputSchema, zedTokenSchema } from "../shared";
import { librarySortSchema } from "../shared/library";
import { createUniqueRefsInputSchema } from "../shared/ref-list";
import {
	assetUploadRouteSchema,
	uploadFileObjectSchema,
} from "../storage/schema";
import { metadataSchema } from "./parts/metadata";
import { assetIdSchema } from "./ref";
import { assetFieldsSchema, assetFiltersSchema } from "./schema";

export const listAssetsInputSchema = z.object({
	...paginationInputSchema.shape,
	...zedTokenSchema.shape,
	filters: assetFiltersSchema.optional(),
	sort: librarySortSchema.default("newest"),
});

export const findAssetInputSchema = z.object({
	id: assetIdSchema,
	...zedTokenSchema.shape,
});

/** Only the given title and metadata fields change; an empty string clears a field. */
export const saveAssetInputSchema = z.object({
	id: assetIdSchema,
	title: assetFieldsSchema.shape.title.optional(),
	metadata: metadataSchema.optional(),
	/** The metadata generation whose suggestion the save applies; it is cleared with the save. */
	metadataGeneration: z.number().int().optional(),
});

export const generateAssetMetadataInputSchema = z.object({
	id: assetIdSchema,
});

export const missingMetadataInputSchema = z.object({});

export const generateMissingMetadataInputSchema = z.object({
	/** Only these assets; every one the user can edit when left out. */
	ids: z.array(assetIdSchema).min(1).max(100).optional(),
});

export const dismissMetadataSuggestionInputSchema = z.object({
	id: assetIdSchema,
	generation: z.number().int(),
});

export const addAssetToLibraryInputSchema = z.object({
	id: assetIdSchema,
});

export const createAssetsFromUploadsInputSchema = z.object({
	route: assetUploadRouteSchema,
	files: z.array(uploadFileObjectSchema).min(1),
	/** The client's key for a library upload; a repeated call joins its activity run. */
	uploadKey: z.uuid().optional(),
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
