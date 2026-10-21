import {
	addAssetToLibraryInputSchema,
	createAssetsFromUploadsInputSchema,
	createAssetsFromUploadsResponseSchema,
	deleteAssetsInputSchema,
	deleteAssetsResponseSchema,
	findAssetInputSchema,
	findAssetResponseSchema,
	listAssetsInputSchema,
	listAssetsResponseSchema,
	reprocessAssetInputSchema,
	reprocessAssetResponseSchema,
	saveAssetInputSchema,
	saveAssetResponseSchema,
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
	createFromUploads: base
		.meta(
			openapi({
				method: "POST",
				path: "/assets/from-uploads",
				summary: "Create assets from uploaded files, with one result per file",
				tags: [
					"Assets",
				],
			}),
		)
		.input(createAssetsFromUploadsInputSchema)
		.output(createAssetsFromUploadsResponseSchema),
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
				summary: "Update an asset's title and metadata",
				tags: [
					"Assets",
				],
			}),
		)
		.input(saveAssetInputSchema)
		.output(saveAssetResponseSchema),
	addToLibrary: base
		.meta(
			openapi({
				method: "POST",
				path: "/assets/{id}/add-to-library",
				summary: "Move a chat upload into the library",
				tags: [
					"Assets",
				],
			}),
		)
		.input(addAssetToLibraryInputSchema)
		.output(saveAssetResponseSchema),
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
	reprocess: base
		.meta(
			openapi({
				method: "POST",
				path: "/assets/{id}/reprocess",
				summary: "Process an asset again",
				tags: [
					"Assets",
				],
			}),
		)
		.input(reprocessAssetInputSchema)
		.output(reprocessAssetResponseSchema),
};
