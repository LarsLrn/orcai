import { z } from "zod/v4";
import { entityCapabilitiesSchema } from "../authorization";
import { blockIdSchema } from "../block/ref";
import { assetFileTypeSchema } from "../shared/primitives/file-type";
import {
	pipelineFailureSchema,
	pipelineStatusSchema,
} from "../shared/primitives/pipeline-status";
import { bucketSchema } from "../storage/parts/buckets";
import { userIdSchema } from "../user/ref";
import { metadataSchema, metadataSuggestionSchema } from "./parts/metadata";
import { assetOriginSchema } from "./parts/origin";
import { assetIdSchema } from "./ref";

export const assetFieldsSchema = z.object({
	title: z.string().min(1),
	metadata: metadataSchema,
});

export const assetSchema = assetFieldsSchema.extend({
	id: assetIdSchema,
	bucket: bucketSchema,
	prefix: z.string(),
	size: z.number().int(),
	processingStatus: pipelineStatusSchema,
	processingFailure: pipelineFailureSchema.nullable(),
	/** The uploaded file's name; unset for assets uploaded before it was kept. */
	fileName: z.string().nullable(),
	/** Null until metadata was generated for the asset. */
	metadataStatus: pipelineStatusSchema.nullable(),
	metadataFailure: pipelineFailureSchema.nullable(),
	metadataSuggestion: metadataSuggestionSchema.nullable(),
	/** The metadata generation the suggestion belongs to. */
	metadataGeneration: z.number().int(),
	fileType: assetFileTypeSchema,
	origin: assetOriginSchema,
	userId: userIdSchema,
	createdAt: z.coerce.date().nullable(),
	updatedAt: z.coerce.date().nullable(),
});

export const assetWithCapabilitiesSchema = assetSchema.extend({
	capabilities: entityCapabilitiesSchema,
});

export const assetFiltersSchema = z.object({
	ids: z.array(assetIdSchema).optional(),
	search: z.string().optional(),
	/** Only assets attached to this repository. */
	repositoryId: blockIdSchema.optional(),
	/** Only assets of this origin; both when left out. */
	origin: assetOriginSchema.optional(),
});

export type Asset = z.infer<typeof assetSchema>;
export type AssetWithCapabilities = z.infer<typeof assetWithCapabilitiesSchema>;
