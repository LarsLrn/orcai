import { z } from "zod/v4";
import {
	assetDeleteSchema,
	assetInsertSchema,
	assetSelectSchema,
	assetUpdateSchema,
} from "@/lib/orpc/schemas/asset";
import { paginationSchema, statusSchema } from "@/lib/orpc/schemas/shared";
import { base } from "./base";

export const listAssetsContract = base
	.route({
		method: "GET",
		path: "/assets",
		summary: "List all assets",
		tags: ["Assets"],
	})
	.input(paginationSchema)
	.output(z.object({ data: z.array(assetSelectSchema), rowCount: z.number() }));

export const createAssetContract = base
	.route({
		method: "POST",
		path: "/assets",
		summary: "Create an asset",
		tags: ["Assets"],
	})
	.input(assetInsertSchema)
	.output(assetSelectSchema);

export const findAssetContract = base
	.route({
		method: "GET",
		path: "/assets/{id}",
		summary: "Find an asset",
		tags: ["Assets"],
	})
	.input(assetSelectSchema.pick({ id: true }))
	.output(z.object({ data: assetSelectSchema }));

export const updateAssetContract = base
	.route({
		method: "PUT",
		path: "/assets/{id}",
		summary: "Update an asset",
		tags: ["Assets"],
	})
	.errors({
		NOT_FOUND: {
			message: "Asset not found",
			data: z.object({ id: assetUpdateSchema.shape.id }),
		},
	})
	.input(assetUpdateSchema)
	.output(z.object({ data: assetSelectSchema }));

export const deleteAssetContract = base
	.route({
		method: "DELETE",
		path: "/assets",
		summary: "Delete an asset",
		tags: ["Assets"],
	})
	.input(assetDeleteSchema)
	.output(statusSchema);
