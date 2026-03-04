import { z } from "zod/v4";
import { fileTypeSchema } from "@/lib/s3/schema/file-schema";
import { assetSelectSchema } from "./asset";
import { baseBlockSelectSchema } from "./block";

/**
 * ----------------
 * Base Schemas
 * ----------------
 */

const baseChunkPayloadSchema = z.object({
	asset_id: assetSelectSchema.shape.id,
	block_id: baseBlockSelectSchema.shape.id,
	text: z.string(),
	title: z.string(),
	page: z.number().int().nonnegative().optional(),
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

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const assetPointSelectSchema = z.object({
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

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const assetPointInsertSchema = z.object({
	courseId: z.uuidv4(),
	payload: assetPointPayloadSchema,
	vector: assetPointSelectSchema.pick({
		vector: true,
	}),
});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const assetPointUpdateSchema = assetPointInsertSchema.extend(
	z.object({
		id: assetPointSelectSchema.pick({
			id: true,
		}),
	}).shape,
);

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const assetPointDeleteSchema = z.object({
	assetId: z.uuidv4(),
	refs: z.array(
		assetPointSelectSchema.pick({
			id: true,
		}),
	),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type AssetPoint = z.infer<typeof assetPointSelectSchema>;
export type AssetPointInsert = z.infer<typeof assetPointInsertSchema>;
export type AssetPointUpdate = z.infer<typeof assetPointUpdateSchema>;
export type AssetPointDelete = z.infer<typeof assetPointDeleteSchema>;

export type AssetPointPayload = z.infer<typeof assetPointPayloadSchema>;
