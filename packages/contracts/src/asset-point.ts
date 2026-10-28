import {
	browseRepositoryAssetPointsInputSchema,
	browseRepositoryAssetPointsResponseSchema,
	listAssetPointsResponseSchema,
	searchRepositoryAssetPointsInputSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const assetPointContracts = {
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
	browseRepository: base
		.meta(
			openapi({
				method: "POST",
				path: "/repositories/{repositoryId}/points/browse",
				summary: "Browse repository asset points",
				tags: [
					"Asset Points",
				],
			}),
		)
		.input(browseRepositoryAssetPointsInputSchema)
		.output(browseRepositoryAssetPointsResponseSchema),
};
