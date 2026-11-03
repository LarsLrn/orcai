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
	prepareAssetAgainInputSchema,
	prepareAssetAgainResponseSchema,
	saveAssetInputSchema,
	saveAssetResponseSchema,
	statusResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Assets",
		],
	}),
);

export const assetContracts = {
	list: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/assets/list",
				summary: "List all assets",
			}),
		)
		.input(listAssetsInputSchema)
		.output(listAssetsResponseSchema),
	createFromUploads: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/assets/from-uploads",
				summary: "Create assets from uploaded files, with one result per file",
			}),
		)
		.input(createAssetsFromUploadsInputSchema)
		.output(createAssetsFromUploadsResponseSchema),
	find: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/assets/{id}",
				summary: "Find an asset",
			}),
		)
		.input(findAssetInputSchema)
		.output(findAssetResponseSchema),
	save: tagged
		.meta(
			openapi({
				method: "PUT",
				path: "/assets/save",
				summary:
					"Change an asset's title and the given metadata fields; the others keep their values",
			}),
		)
		.input(saveAssetInputSchema)
		.output(saveAssetResponseSchema),
	addToLibrary: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/assets/{id}/add-to-library",
				summary: "Move a chat upload into the Library",
			}),
		)
		.input(addAssetToLibraryInputSchema)
		.output(saveAssetResponseSchema),
	delete: tagged
		.meta(
			openapi({
				method: "DELETE",
				path: "/assets",
				summary: "Delete an asset",
			}),
		)
		.input(deleteAssetsInputSchema)
		.output(deleteAssetsResponseSchema),
	prepareAgain: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/assets/{id}/prepare-again",
				summary: "Prepare an asset again",
			}),
		)
		.input(prepareAssetAgainInputSchema)
		.output(prepareAssetAgainResponseSchema),
	generateMetadata: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/assets/{id}/generate-metadata",
				summary:
					"Generate a metadata suggestion for an asset with the utility model, to review",
			}),
		)
		.input(generateAssetMetadataInputSchema)
		.output(statusResponseSchema),
	dismissMetadataSuggestion: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/assets/{id}/dismiss-metadata-suggestion",
				summary: "Dismiss an asset's metadata suggestion",
			}),
		)
		.input(dismissMetadataSuggestionInputSchema)
		.output(statusResponseSchema),
	missingMetadata: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/assets/missing-metadata",
				summary:
					"Count the Library assets you can edit whose metadata was never generated or failed",
			}),
		)
		.input(missingMetadataInputSchema)
		.output(missingMetadataResponseSchema),
	generateMissingMetadata: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/assets/generate-missing-metadata",
				summary:
					"Generate metadata for the Library assets you can edit that lack it, filling empty fields",
			}),
		)
		.input(generateMissingMetadataInputSchema)
		.output(missingMetadataResponseSchema),
};
