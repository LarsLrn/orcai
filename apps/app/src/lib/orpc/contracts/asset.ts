import { base } from "@orcai/contracts";
import {
	paginationInputSchema,
	statusResponseSchema,
	zedTokenSchema,
} from "@orcai/schema";
import { z } from "zod/v4";
import {
	assetDeleteSchema,
	assetInsertSchema,
	assetSaveManySchema,
	assetSaveSchema,
	assetSelectSchema,
} from "@/lib/orpc/schemas/asset";

export const listAssetsContract = base
	.route({
		method: "POST",
		path: "/assets/list",
		summary: "List all assets",
		tags: [
			"Assets",
		],
	})
	.input(
		z.object({
			...paginationInputSchema.shape,
			...zedTokenSchema.shape,
			filters: z
				.object({
					ids: z.array(assetSelectSchema.shape.id).optional(),
					search: z.string().optional(),
				})
				.optional(),
		}),
	)
	.output(
		z.object({
			data: z.array(assetSelectSchema),
			rowCount: z.number(),
		}),
	);

export const createAssetContract = base
	.route({
		method: "POST",
		path: "/assets",
		summary: "Create an asset",
		tags: [
			"Assets",
		],
	})
	.input(assetInsertSchema)
	.output(
		z.object({
			data: assetSelectSchema,
			meta: zedTokenSchema.optional(),
		}),
	);

export const findAssetContract = base
	.route({
		method: "GET",
		path: "/assets/{id}",
		summary: "Find an asset",
		tags: [
			"Assets",
		],
	})
	.input(
		z.object({
			...assetSelectSchema.pick({
				id: true,
			}).shape,
			...zedTokenSchema.shape,
		}),
	)
	.output(
		z.object({
			data: assetSelectSchema,
		}),
	);

export const saveAssetContract = base
	.route({
		method: "PUT",
		path: "/assets/save",
		summary: "Create or update an asset",
		tags: [
			"Assets",
		],
	})
	.input(assetSaveSchema)
	.output(
		z.object({
			data: assetSelectSchema,
			meta: zedTokenSchema.optional(),
		}),
	);

export const saveManyAssetsContract = base
	.route({
		method: "PUT",
		path: "/assets/save-many",
		summary: "Create many assets from uploaded files",
		tags: [
			"Assets",
		],
	})
	.input(assetSaveManySchema)
	.output(
		z.object({
			data: z.array(assetSelectSchema),
			meta: zedTokenSchema.optional(),
		}),
	);

export const deleteAssetContract = base
	.route({
		method: "DELETE",
		path: "/assets",
		summary: "Delete an asset",
		tags: [
			"Assets",
		],
	})
	.input(assetDeleteSchema)
	.output(statusResponseSchema);
