import {
	addAssetToLibraryInputSchema,
	createAssetsFromUploadsInputSchema,
	createAssetsFromUploadsResponseSchema,
	deleteAssetsInputSchema,
	deleteAssetsResponseSchema,
	dismissMetadataSuggestionInputSchema,
	findAssetInputSchema,
	findAssetResponseSchema,
	generateAssetMetadataInputSchema,
	generateMissingMetadataInputSchema,
	listAssetsInputSchema,
	listAssetsResponseSchema,
	missingMetadataInputSchema,
	missingMetadataResponseSchema,
	reprocessAssetInputSchema,
	reprocessAssetResponseSchema,
	saveAssetInputSchema,
	saveAssetResponseSchema,
	statusResponseSchema,
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
				summary:
					"Change an asset's title and the given metadata fields; the others keep their values",
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
	generateMetadata: base
		.meta(
			openapi({
				method: "POST",
				path: "/assets/{id}/generate-metadata",
				summary:
					"Generate a metadata suggestion for an asset with the utility model, to review",
				tags: [
					"Assets",
				],
			}),
		)
		.input(generateAssetMetadataInputSchema)
		.output(statusResponseSchema),
	dismissMetadataSuggestion: base
		.meta(
			openapi({
				method: "POST",
				path: "/assets/{id}/dismiss-metadata-suggestion",
				summary: "Dismiss an asset's metadata suggestion",
				tags: [
					"Assets",
				],
			}),
		)
		.input(dismissMetadataSuggestionInputSchema)
		.output(statusResponseSchema),
	missingMetadata: base
		.meta(
			openapi({
				method: "POST",
				path: "/assets/missing-metadata",
				summary:
					"Count the library assets you can edit whose metadata was never generated or failed",
				tags: [
					"Assets",
				],
			}),
		)
		.input(missingMetadataInputSchema)
		.output(missingMetadataResponseSchema),
	generateMissingMetadata: base
		.meta(
			openapi({
				method: "POST",
				path: "/assets/generate-missing-metadata",
				summary:
					"Generate metadata for the library assets you can edit that lack it, filling empty fields",
				tags: [
					"Assets",
				],
			}),
		)
		.input(generateMissingMetadataInputSchema)
		.output(missingMetadataResponseSchema),
};
