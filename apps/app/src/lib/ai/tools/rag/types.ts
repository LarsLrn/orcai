import type { BlockId } from "@orcai/core";
import type { AssetPoint, DatabaseBlock } from "@orcai/schema";
import { z } from "zod/v4";

/** Text of one document read as one piece: a chunk, or neighbouring chunks joined. */
export const passageSchema = z.object({
	/** What the model cites the passage by. */
	ref: z.string(),
	/** The point id of the chunk the passage was read for. */
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

export const knowledgeBaseDocumentSchema = z.object({
	assetId: z.string(),
	title: z.string(),
	citation: z.string().optional(),
});

export type KnowledgeBaseDocument = z.infer<typeof knowledgeBaseDocumentSchema>;

export type PointWithBlock = AssetPoint & {
	sourceBlock: {
		id: BlockId;
		name: DatabaseBlock["name"];
	};
};
