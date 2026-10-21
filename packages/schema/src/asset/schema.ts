import { z } from "zod/v4";
import { entityCapabilitiesSchema } from "../authorization";
import { blockIdSchema } from "../block/ref";
import { assetFileTypeSchema } from "../shared/primitives/file-type";
import { bucketSchema } from "../storage/parts/buckets";
import { userIdSchema } from "../user/ref";
import { metadataSchema } from "./parts/metadata";
import { assetOriginSchema } from "./parts/origin";
import { processingStatusSchema } from "./parts/processing-status";
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
	processingStatus: processingStatusSchema,
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
