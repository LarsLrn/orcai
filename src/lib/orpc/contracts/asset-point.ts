import { z } from "zod/v4";
import { base } from "./base";

const baseChunkPayloadSchema = z.object({
	course_id: z.string(),
	asset_id: z.string(),
	text: z.string(),
	title: z.string(),
	depth: z.number(),
	tokens: z.number(),
	chunkIndex: z.number(),
	chunkCount: z.number(),
	createdAt: z.string(),
});

const fileTypeSchema = z.enum([
	"pdf",
	"jpeg",
	"png",
	"docx",
	"pptx",
	"md",
	"unknown",
]);

const imagePointPayloadSchema = baseChunkPayloadSchema.extend({
	source: z.literal("image"),
	file_reference: z.string(),
	file_type: fileTypeSchema,
});

const textPointPayloadSchema = baseChunkPayloadSchema.extend({
	source: z.literal("text"),
	file_reference: z.string().optional(),
	file_type: fileTypeSchema.optional(),
});

export const assetPointPayloadSchema = z.discriminatedUnion("source", [
	imagePointPayloadSchema,
	textPointPayloadSchema,
]);

const assetPointSelectSchema = z.object({
	id: z.union([z.string(), z.number()]),
	version: z.number(),
	score: z.number(),
	payload: z.record(z.string(), z.unknown()).nullable().optional(),
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
		.union([z.string(), z.number(), z.record(z.string(), z.unknown())])
		.nullable()
		.optional(),
	order_value: z
		.union([z.number(), z.record(z.string(), z.unknown())])
		.nullable()
		.optional(),
});

export const assetPointInsertSchema = z.object({
	courseId: z.uuidv4(),
	payload: assetPointPayloadSchema,
	vector: assetPointSelectSchema.pick({ vector: true }),
});

export const assetPointUpdateSchema = assetPointInsertSchema.extend(
	z.object({
		id: assetPointSelectSchema.pick({ id: true }),
	}).shape,
);

export const assetPointDeleteSchema = z.object({
	assetId: z.uuidv4(),
	refs: z.array(assetPointSelectSchema.pick({ id: true })),
});

export const listAssetPointsContract = base
	.route({
		method: "GET",
		path: "/assets/points",
		summary: "List all asset points",
		tags: ["Asset Points"],
	})
	.input(
		z.object({
			filters: z.object({
				search: z.string().optional(),
				assetId: z.uuidv4().optional(),
				limit: z.number().int().min(1).optional(),
			}),
		}),
	)
	.output(z.object({ data: z.array(assetPointSelectSchema) }));

export const createAssetPointContract = base
	.route({
		method: "POST",
		path: "/assets/{assetId}/points",
		summary: "Create an asset point",
		tags: ["Asset Points"],
	})
	.input(assetPointInsertSchema)
	.output(z.object({ data: assetPointSelectSchema }));

export const findAssetPointContract = base
	.route({
		method: "GET",
		path: "/assets/{assetId}/points/{id}",
		summary: "Find an asset point",
		tags: ["Asset Points"],
	})
	.input(assetPointSelectSchema.pick({ id: true }))
	.output(z.object({ data: assetPointSelectSchema }));

export const updateAssetPointContract = base
	.route({
		method: "PUT",
		path: "/assets/{assetId}/points/{id}",
		summary: "Update an asset point",
		tags: ["Asset Points"],
	})
	.errors({
		NOT_FOUND: {
			message: "Asset point not found",
			data: assetPointSelectSchema.pick({ id: true }),
		},
	})
	.input(assetPointUpdateSchema)
	.output(z.object({ data: assetPointSelectSchema }));

export const deleteAssetPointContract = base
	.route({
		method: "DELETE",
		path: "/assets/{assetId}/points",
		summary: "Delete an asset point",
		tags: ["Asset Points"],
	})
	.input(assetPointDeleteSchema)
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));
