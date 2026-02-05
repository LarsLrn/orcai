import { z } from "zod/v4";
import {
	assetDeleteSchema,
	assetInsertSchema,
	assetSelectSchema,
	assetUpdateSchema,
} from "@/lib/orpc/schemas/asset";
import {
	paginationSchema,
	statusSchema,
	zedTokenSchema,
} from "@/lib/orpc/schemas/shared";
import { base } from "./base";

export const listAssetsContract = base
	.route({
		method: "POST",
		path: "/assets",
		summary: "List all assets",
		tags: ["Assets"],
	})
	.input(
		z.object({
			...paginationSchema.shape,
			...zedTokenSchema.shape,
			filters: z
				.object({
					ids: z.array(assetSelectSchema.shape.id).optional(),
				})
				.optional(),
		}),
	)
	.output(z.object({ data: z.array(assetSelectSchema), rowCount: z.number() }));

export const createAssetContract = base
	.route({
		method: "POST",
		path: "/assets",
		summary: "Create an asset",
		tags: ["Assets"],
	})
	.input(assetInsertSchema)
	.output(
		z.object({ data: assetSelectSchema, meta: zedTokenSchema.optional() }),
	);

export const findAssetContract = base
	.route({
		method: "GET",
		path: "/assets/{id}",
		summary: "Find an asset",
		tags: ["Assets"],
	})
	.input(
		z.object({
			...assetSelectSchema.pick({ id: true }).shape,
			...zedTokenSchema.shape,
		}),
	)
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
