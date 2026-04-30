import { z } from "zod/v4";
import { assetIdSchema } from "../asset";
import { blockIdSchema } from "../block";
import { fileTypeSchema } from "../zod/file";

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

export type AssetPoint = z.infer<typeof assetPointSchema>;
export type AssetPointPayload = z.infer<typeof assetPointPayloadSchema>;
