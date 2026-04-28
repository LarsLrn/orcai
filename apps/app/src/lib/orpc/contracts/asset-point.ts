import { base } from "@orcai/contracts";
import {
	assetPointDeleteSchema,
	assetPointInsertSchema,
	assetPointSelectSchema,
	assetPointUpdateSchema,
	retrievalModeSchema,
	statusResponseSchema,
} from "@orcai/schema";
import { z } from "zod/v4";
import { baseBlockSelectSchema } from "@/lib/orpc/schemas/block";

export const listAssetPointContract = base
	.route({
		method: "POST",
		path: "/assets/points",
		summary: "List all asset points",
		tags: [
			"Asset Points",
		],
	})
	.input(
		z.object({
			filters: z.object({
				queries: z.array(z.string()).optional(),
				pointIds: z.array(assetPointSelectSchema.shape.id).optional(),
				assetIds: z.array(assetPointSelectSchema.shape.id).optional(),
				limit: z.number().int().min(1).optional(),
				blockId: baseBlockSelectSchema.shape.id.optional(),
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
			}),
		}),
	)
	.output(
		z.object({
			data: z.array(assetPointSelectSchema),
			metadata: z
				.object({
					retrievalMode: retrievalModeSchema,
					scoreThreshold: z.number().min(0).max(1),
					candidateCount: z.number().int().min(0),
					returnedCount: z.number().int().min(0),
				})
				.optional(),
		}),
	);

export const createAssetPointContract = base
	.route({
		method: "POST",
		path: "/assets/{assetId}/points",
		summary: "Create an asset point",
		tags: [
			"Asset Points",
		],
	})
	.input(assetPointInsertSchema)
	.output(
		z.object({
			data: assetPointSelectSchema,
		}),
	);

export const findAssetPointContract = base
	.route({
		method: "GET",
		path: "/assets/{assetId}/points/{id}",
		summary: "Find an asset point",
		tags: [
			"Asset Points",
		],
	})
	.input(
		assetPointSelectSchema.pick({
			id: true,
		}),
	)
	.output(
		z.object({
			data: assetPointSelectSchema,
		}),
	);

export const updateAssetPointContract = base
	.route({
		method: "PUT",
		path: "/assets/{assetId}/points/{id}",
		summary: "Update an asset point",
		tags: [
			"Asset Points",
		],
	})
	.errors({
		NOT_FOUND: {
			message: "Asset point not found",
			data: assetPointSelectSchema.pick({
				id: true,
			}),
		},
	})
	.input(assetPointUpdateSchema)
	.output(
		z.object({
			data: assetPointSelectSchema,
		}),
	);

export const deleteAssetPointContract = base
	.route({
		method: "DELETE",
		path: "/assets/{assetId}/points",
		summary: "Delete an asset point",
		tags: [
			"Asset Points",
		],
	})
	.input(assetPointDeleteSchema)
	.output(statusResponseSchema);
