import { z } from "zod/v4";
import { base } from "./base";

const baseChunkPayloadSchema = z.object({
	course_id: z.string(),
	document_id: z.string(),
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

const imageChunkPayloadSchema = baseChunkPayloadSchema.extend({
	source: z.literal("image"),
	file_reference: z.string(),
	file_type: fileTypeSchema,
});

const textChunkPayloadSchema = baseChunkPayloadSchema.extend({
	source: z.literal("text"),
	file_reference: z.string().optional(),
	file_type: fileTypeSchema.optional(),
});

export const chunkPayloadSchema = z.discriminatedUnion("source", [
	imageChunkPayloadSchema,
	textChunkPayloadSchema,
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
	payload: chunkPayloadSchema,
	vector: assetPointSelectSchema.pick({ vector: true }),
});

export const assetPointUpdateSchema = assetPointInsertSchema.extend(
	z.object({
		id: assetPointSelectSchema.pick({ id: true }),
	}).shape,
);

export const assetPointDeleteSchema = z.object({
	document_id: z.uuidv4(),
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
				documentId: z.uuidv4().optional(),
				limit: z.number().int().min(1).optional(),
			}),
		}),
	)
	.output(z.object({ data: z.array(assetPointSelectSchema) }));

export const createAssetPointContract = base
	.route({
		method: "POST",
		path: "/assets/{document_id}/points",
		summary: "Create an asset point",
		tags: ["Asset Points"],
	})
	.input(assetPointInsertSchema)
	.output(z.object({ data: assetPointSelectSchema }));

export const findAssetPointContract = base
	.route({
		method: "GET",
		path: "/assets/{document_id}/points/{id}",
		summary: "Find an asset point",
		tags: ["Asset Points"],
	})
	.input(assetPointSelectSchema.pick({ id: true }))
	.output(z.object({ data: assetPointSelectSchema }));

export const updateAssetPointContract = base
	.route({
		method: "PUT",
		path: "/assets/{document_id}/points/{id}",
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
		path: "/assets/{document_id}/points",
		summary: "Delete an asset point",
		tags: ["Asset Points"],
	})
	.input(assetPointDeleteSchema)
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));
