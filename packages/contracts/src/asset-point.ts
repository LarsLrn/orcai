import {
	createAssetPointInputSchema,
	createAssetPointResponseSchema,
	deleteAssetPointInputSchema,
	deleteAssetPointResponseSchema,
	findAssetPointInputSchema,
	findAssetPointResponseSchema,
	listAssetPointsInputSchema,
	listAssetPointsResponseSchema,
	searchRepositoryAssetPointsInputSchema,
	updateAssetPointInputSchema,
	updateAssetPointResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const assetPointContracts = {
	list: base
		.meta(
			openapi({
				method: "POST",
				path: "/assets/{assetId}/points",
				summary: "List asset points",
				tags: [
					"Asset Points",
				],
			}),
		)
		.input(listAssetPointsInputSchema)
		.output(listAssetPointsResponseSchema),
	searchRepository: base
		.meta(
			openapi({
				method: "POST",
				path: "/repositories/{repositoryId}/points/search",
				summary: "Search repository asset points",
				tags: [
					"Asset Points",
				],
			}),
		)
		.input(searchRepositoryAssetPointsInputSchema)
		.output(listAssetPointsResponseSchema),
	create: base
		.meta(
			openapi({
				method: "POST",
				path: "/assets/{assetId}/points",
				summary: "Create an asset point",
				tags: [
					"Asset Points",
				],
			}),
		)
		.input(createAssetPointInputSchema)
		.output(createAssetPointResponseSchema),
	find: base
		.meta(
			openapi({
				method: "GET",
				path: "/assets/{assetId}/points/{id}",
				summary: "Find an asset point",
				tags: [
					"Asset Points",
				],
			}),
		)
		.input(findAssetPointInputSchema)
		.output(findAssetPointResponseSchema),
	update: base
		.meta(
			openapi({
				method: "PUT",
				path: "/assets/{assetId}/points/{id}",
				summary: "Update an asset point",
				tags: [
					"Asset Points",
				],
			}),
		)
		.input(updateAssetPointInputSchema)
		.output(updateAssetPointResponseSchema),
	delete: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/assets/{assetId}/points",
				summary: "Delete an asset point",
				tags: [
					"Asset Points",
				],
			}),
		)
		.input(deleteAssetPointInputSchema)
		.output(deleteAssetPointResponseSchema),
};
