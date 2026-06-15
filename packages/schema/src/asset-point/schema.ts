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
	title: z.string(),
	documentTotalPages: z.number().int().positive().optional(),
	chunkPageStart: z.number().int().positive().optional(),
	chunkPageEnd: z.number().int().positive().optional(),
	depth: z.number(),
	tokens: z.number(),
	chunk_index: z.number(),
	chunkCount: z.number(),
	createdAt: z.string(),
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
	chunkIndices: z.array(z.number().int().min(0)).optional(),
});

export type AssetPoint = z.infer<typeof assetPointSchema>;
export type AssetPointPayload = z.infer<typeof assetPointPayloadSchema>;
