import { z } from "zod/v4";
import {
	assetPointDeleteSchema,
	assetPointInsertSchema,
	assetPointSelectSchema,
	assetPointUpdateSchema,
} from "@/lib/orpc/schemas/asset-point";
import { statusSchema } from "@/lib/orpc/schemas/shared";
import { base } from "./base";

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
				assetId: assetPointSelectSchema.shape.id.optional(),
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
	.output(statusSchema);
