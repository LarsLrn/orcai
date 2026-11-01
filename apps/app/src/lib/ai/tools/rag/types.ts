import type { BlockId } from "@orcai/core";
import {
	assetReadinessSchema,
	type DatabaseBlock,
	type RetrievedAssetPoint,
} from "@orcai/schema";
import { z } from "zod/v4";

/** Text of one asset read as one piece: a point, or neighbouring points joined. */
export const passageSchema = z.object({
	/** What the model cites the passage by. */
	ref: z.string(),
	/** The point id the passage was read for. */
	id: z.string(),
	assetId: z.string(),
	title: z.string(),
	blockName: z.string(),
	pageStart: z.number().optional(),
	pageEnd: z.number().optional(),
	totalPages: z.number().optional(),
	text: z.string(),
});

export type Passage = z.infer<typeof passageSchema>;

export const repositoryAssetSchema = z.object({
	assetId: z.string(),
	title: z.string(),
	citation: z.string().optional(),
	description: z.string().optional(),
	/** Only ready assets are searchable. */
	state: assetReadinessSchema.shape.state,
	failure: assetReadinessSchema.shape.failure.unwrap().optional(),
});

export type RepositoryAsset = z.infer<typeof repositoryAssetSchema>;

export type PointWithBlock = RetrievedAssetPoint & {
	repository: {
		id: BlockId;
		name: DatabaseBlock["name"];
	};
};
