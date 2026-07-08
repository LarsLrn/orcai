import {
	createAssetInputSchema,
	createAssetResponseSchema,
	deleteAssetsInputSchema,
	deleteAssetsResponseSchema,
	findAssetInputSchema,
	findAssetResponseSchema,
	listAssetsInputSchema,
	listAssetsResponseSchema,
	saveAssetInputSchema,
	saveAssetResponseSchema,
	saveManyAssetsInputSchema,
	saveManyAssetsResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const assetContracts = {
	list: base
		.meta(
			openapi({
				method: "POST",
				path: "/assets/list",
				summary: "List all assets",
				tags: [
					"Assets",
				],
			}),
		)
		.input(listAssetsInputSchema)
		.output(listAssetsResponseSchema),
	create: base
		.meta(
			openapi({
				method: "POST",
				path: "/assets",
				summary: "Create an asset",
				tags: [
					"Assets",
				],
			}),
		)
		.input(createAssetInputSchema)
		.output(createAssetResponseSchema),
	find: base
		.meta(
			openapi({
				method: "GET",
				path: "/assets/{id}",
				summary: "Find an asset",
				tags: [
					"Assets",
				],
			}),
		)
		.input(findAssetInputSchema)
		.output(findAssetResponseSchema),
	save: base
		.meta(
			openapi({
				method: "PUT",
				path: "/assets/save",
				summary: "Create or update an asset",
				tags: [
					"Assets",
				],
			}),
		)
		.input(saveAssetInputSchema)
		.output(saveAssetResponseSchema),
	saveMany: base
		.meta(
			openapi({
				method: "PUT",
				path: "/assets/save-many",
				summary: "Create many assets from uploaded files",
				tags: [
					"Assets",
				],
			}),
		)
		.input(saveManyAssetsInputSchema)
		.output(saveManyAssetsResponseSchema),
	delete: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/assets",
				summary: "Delete an asset",
				tags: [
					"Assets",
				],
			}),
		)
		.input(deleteAssetsInputSchema)
		.output(deleteAssetsResponseSchema),
};
