import { z } from "zod/v4";
import { assetIdSchema, blockIdSchema } from "../shared/ids";
import { fileTypeSchema } from "../shared/primitives/file-type";
import { retrievalModeSchema } from "../shared/primitives/retrieval-mode";

const baseChunkPayloadSchema = z.object({
	asset_id: assetIdSchema,
	block_id: blockIdSchema,
	text: z.string(),
	lexical_text: z.string().optional(),
	documentTotalPages: z.number().int().positive().optional(),
	chunkPageStart: z.number().int().positive().optional(),
	chunkPageEnd: z.number().int().positive().optional(),
	depth: z.number(),
	tokens: z.number(),
	chunk_index: z.number(),
	chunkCount: z.number(),
	createdAt: z.string(),
	/** The link's indexing attempt that wrote the point. */
	index_attempt: z.number().int().nonnegative(),
	/** False until the attempt that wrote the point completes. */
	published: z.boolean(),
});

const imagePointPayloadSchema = baseChunkPayloadSchema.extend({
	source: z.literal("image"),
	file_reference: z.string().optional(),
	file_type: fileTypeSchema.optional(),
});

const textPointPayloadSchema = baseChunkPayloadSchema.extend({
	source: z.literal("text"),
});

const assetPointPayloadSchema = z.discriminatedUnion("source", [
	imagePointPayloadSchema,
	textPointPayloadSchema,
]);

export const assetPointSchema = z.object({
	id: z.string(),
	version: z.number(),
	score: z.number(),
	payload: z.discriminatedUnion("source", [
		baseChunkPayloadSchema.extend(imagePointPayloadSchema.shape),
		baseChunkPayloadSchema.extend(textPointPayloadSchema.shape),
	]),
	vector: z
		.union([
			z.record(z.string(), z.unknown()),
			z.array(z.number()),
			z.array(z.array(z.number())),
			z.record(
				z.string(),
				z.union([
					z.array(z.number()),
					z.array(z.array(z.number())),
					z.object({
						indices: z.array(z.number()),
						values: z.array(z.number()),
					}),
					z.undefined(),
				]),
			),
		])
		.nullable()
		.optional(),
	shard_key: z
		.union([
			z.string(),
			z.number(),
			z.record(z.string(), z.unknown()),
		])
		.nullable()
		.optional(),
	order_value: z
		.union([
			z.number(),
			z.record(z.string(), z.unknown()),
		])
		.nullable()
		.optional(),
});

/** The wordings of one search: a query and up to four variants. */
export const SEARCH_QUERIES_MAX = 5;
/** Far above a focused phrase, well within what an embedding model takes. */
export const SEARCH_QUERY_MAX_LENGTH = 1000;

/** One wording of a search. */
export const searchQuerySchema = z.string().max(SEARCH_QUERY_MAX_LENGTH);

export const assetPointsFiltersSchema = z.object({
	queries: z.array(searchQuerySchema).max(SEARCH_QUERIES_MAX).optional(),
	pointIds: z.array(assetPointSchema.shape.id).optional(),
	assetIds: z.array(assetPointSchema.shape.id).optional(),
	limit: z.number().int().min(1).optional(),
	blockId: blockIdSchema.optional(),
	retrievalMode: retrievalModeSchema.optional(),
	candidateLimit: z.number().int().min(1).max(200).optional(),
	maxPerAsset: z.number().int().min(1).optional(),
	page: z.number().int().min(1).optional(),
	pageFrom: z.number().int().min(1).optional(),
	pageTo: z.number().int().min(1).optional(),
	passageIndices: z.array(z.number().int().min(0)).optional(),
});

/**
 * Where a browse continues: from a point in point-id order across the
 * repository, or after a passage in one asset's reading order (page, then
 * passage index; passages without a page last).
 */
export const assetPointBrowseCursorSchema = z.discriminatedUnion("order", [
	z.object({
		order: z.literal("point"),
		from: z.uuid(),
	}),
	z.object({
		order: z.literal("reading"),
		page: z.number().int().min(1).nullable(),
		passageIndex: z.number().int().min(0),
	}),
]);

/** A point as the procedures return it, with its asset's title as it is when read. */
export const retrievedAssetPointSchema = assetPointSchema.extend({
	title: z.string(),
});

export type AssetPoint = z.infer<typeof assetPointSchema>;
export type RetrievedAssetPoint = z.infer<typeof retrievedAssetPointSchema>;
export type AssetPointBrowseCursor = z.infer<
	typeof assetPointBrowseCursorSchema
>;
export type AssetPointPayload = z.infer<typeof assetPointPayloadSchema>;
