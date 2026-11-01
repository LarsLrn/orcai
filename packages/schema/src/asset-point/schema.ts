import { z } from "zod/v4";
import { assetIdSchema } from "../asset/ref";
import { blockIdSchema } from "../block/ref";
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
	/** The link's indexing attempt that wrote the point; points without one count as attempt 0. */
	index_attempt: z.number().int().nonnegative().optional(),
	/** False until the attempt that wrote the point completes; points without it are served. */
	published: z.boolean().optional(),
});

const imagePointPayloadSchema = baseChunkPayloadSchema.extend({
	source: z.literal("image"),
	file_reference: z.string().optional(),
	file_type: fileTypeSchema.optional(),
});

const textPointPayloadSchema = baseChunkPayloadSchema.extend({
	source: z.literal("text"),
});

export const assetPointPayloadSchema = z.discriminatedUnion("source", [
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

export const assetPointsFiltersSchema = z.object({
	queries: z.array(z.string()).optional(),
	pointIds: z.array(assetPointSchema.shape.id).optional(),
	assetIds: z.array(assetPointSchema.shape.id).optional(),
	limit: z.number().int().min(1).optional(),
	/** The result count the recall passes gather candidates for; defaults to `limit`. */
	recallLimit: z.number().int().min(1).optional(),
	blockId: blockIdSchema.optional(),
	minScore: z.number().min(0).max(1).optional(),
	retrievalMode: retrievalModeSchema.optional(),
	candidateLimit: z.number().int().min(1).max(200).optional(),
	denseWeight: z.number().min(0).max(1).optional(),
	lexicalWeight: z.number().min(0).max(1).optional(),
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
