import {
	createAssetPointInputSchema,
	createAssetPointResponseSchema,
	deleteAssetPointInputSchema,
	deleteAssetPointResponseSchema,
	findAssetPointInputSchema,
	findAssetPointResponseSchema,
	listAssetPointsInputSchema,
	listAssetPointsResponseSchema,
	updateAssetPointInputSchema,
	updateAssetPointResponseSchema,
} from "@orcai/schema";
import { base } from "./base";

export const assetPointContracts = {
	list: base
		.route({
			method: "POST",
			path: "/assets/points",
			summary: "List all asset points",
			tags: [
				"Asset Points",
			],
		})
		.input(listAssetPointsInputSchema)
		.output(listAssetPointsResponseSchema),
	create: base
		.route({
			method: "POST",
			path: "/assets/{assetId}/points",
			summary: "Create an asset point",
			tags: [
				"Asset Points",
			],
		})
		.input(createAssetPointInputSchema)
		.output(createAssetPointResponseSchema),
	find: base
		.route({
			method: "GET",
			path: "/assets/{assetId}/points/{id}",
			summary: "Find an asset point",
			tags: [
				"Asset Points",
			],
		})
		.input(findAssetPointInputSchema)
		.output(findAssetPointResponseSchema),
	update: base
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
				data: findAssetPointInputSchema,
			},
		})
		.input(updateAssetPointInputSchema)
		.output(updateAssetPointResponseSchema),
	delete: base
		.route({
			method: "DELETE",
			path: "/assets/{assetId}/points",
			summary: "Delete an asset point",
			tags: [
				"Asset Points",
			],
		})
		.input(deleteAssetPointInputSchema)
		.output(deleteAssetPointResponseSchema),
};
