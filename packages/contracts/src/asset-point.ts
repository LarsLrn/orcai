import {
	browseRepositoryAssetPointsInputSchema,
	browseRepositoryAssetPointsResponseSchema,
	listAssetPointsResponseSchema,
	searchRepositoryAssetPointsInputSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Passages",
		],
	}),
);

export const assetPointContracts = {
	searchRepository: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/repositories/{repositoryId}/points/search",
				summary: "Search the passages of a repository",
			}),
		)
		.input(searchRepositoryAssetPointsInputSchema)
		.output(listAssetPointsResponseSchema),
	browseRepository: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/repositories/{repositoryId}/points/browse",
				summary: "Browse the passages of a repository",
			}),
		)
		.input(browseRepositoryAssetPointsInputSchema)
		.output(browseRepositoryAssetPointsResponseSchema),
};
