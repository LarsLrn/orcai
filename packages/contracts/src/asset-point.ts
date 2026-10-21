import {
	listAssetPointsInputSchema,
	listAssetPointsResponseSchema,
	searchRepositoryAssetPointsInputSchema,
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
};
