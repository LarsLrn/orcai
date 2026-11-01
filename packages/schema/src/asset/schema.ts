import { z } from "zod/v4";
import { activityRunIdSchema } from "../activity/ref";
import { entityCapabilitiesSchema } from "../authorization";
import { blockIdSchema } from "../block/ref";
import { resourceOwnerSchema } from "../resource/schema";
import { libraryScopeSchema } from "../shared/library";
import { assetFileTypeSchema } from "../shared/primitives/file-type";
import {
	pipelineFailureSchema,
	pipelineStatusSchema,
} from "../shared/primitives/pipeline-status";
import { bucketSchema } from "../storage/parts/buckets";
import { userIdSchema } from "../user/ref";
import { assetKeptInSchema } from "./parts/kept-in";
import { metadataSchema, metadataSuggestionSchema } from "./parts/metadata";
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
	keptIn: assetKeptInSchema,
	userId: userIdSchema,
	createdAt: z.coerce.date().nullable(),
	updatedAt: z.coerce.date().nullable(),
});

export const assetWithCapabilitiesSchema = assetSchema.extend({
	capabilities: entityCapabilitiesSchema,
});

/** An asset as library lists return it: with what its tile shows. */
export const assetListItemSchema = assetWithCapabilitiesSchema.extend({
	owner: resourceOwnerSchema,
});

export const assetFiltersSchema = z
	.object({
		ids: z.array(assetIdSchema).optional(),
		search: z.string().optional(),
		/** Only assets attached to this repository. */
		repositoryId: blockIdSchema.optional(),
		/** Only assets kept there; both when left out. */
		keptIn: assetKeptInSchema.optional(),
		scope: libraryScopeSchema.optional(),
		/** Only assets queued or being processed, or only failed ones. */
		processing: z
			.enum([
				"running",
				"failed",
			])
			.optional(),
		/** Only assets with metadata suggestions to review that the reader can edit. */
		suggestions: z.literal(true).optional(),
		/** Only assets of one of the reader's activity runs, wherever they live. */
		runId: activityRunIdSchema.optional(),
	})
	.refine(
		(filters) =>
			!(
				(filters.scope || filters.suggestions) &&
				(filters.repositoryId || filters.ids || filters.runId)
			),
		{
			message:
				"A repository's assets, known ids and a run's assets have no scope or suggestions",
			path: [
				"scope",
			],
		},
	);

export type Asset = z.infer<typeof assetSchema>;
export type AssetWithCapabilities = z.infer<typeof assetWithCapabilitiesSchema>;
export type AssetListItem = z.infer<typeof assetListItemSchema>;
