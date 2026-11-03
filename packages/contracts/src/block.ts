import {
	blockReadinessInputSchema,
	blockReadinessResponseSchema,
	createBlockInputSchema,
	createBlockResponseSchema,
	deleteBlocksInputSchema,
	deleteBlocksResponseSchema,
	findBlockInputSchema,
	findBlockResponseSchema,
	listBlocksInputSchema,
	listBlocksResponseSchema,
	prepareRepositoryAssetAgainInputSchema,
	prepareRepositoryAssetAgainResponseSchema,
	prepareRepositoryFailedAgainInputSchema,
	prepareRepositoryFailedAgainResponseSchema,
	updateBlockInputSchema,
	updateBlockResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Blocks",
		],
	}),
);

export const blockContracts = {
	list: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/blocks",
				summary: "List all blocks",
			}),
		)
		.input(listBlocksInputSchema)
		.output(listBlocksResponseSchema),
	create: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/blocks",
				summary: "Create a block",
			}),
		)
		.input(createBlockInputSchema)
		.output(createBlockResponseSchema),
	find: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/blocks/{id}",
				summary: "Find a block",
			}),
		)
		.input(findBlockInputSchema)
		.output(findBlockResponseSchema),
	update: tagged
		.meta(
			openapi({
				method: "PUT",
				path: "/blocks/{id}",
				summary: "Update a block",
			}),
		)
		.input(updateBlockInputSchema)
		.output(updateBlockResponseSchema),
	delete: tagged
		.meta(
			openapi({
				method: "DELETE",
				path: "/blocks",
				summary: "Delete blocks",
			}),
		)
		.input(deleteBlocksInputSchema)
		.output(deleteBlocksResponseSchema),
	readiness: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/blocks/readiness",
				summary: "Asset readiness of repositories",
			}),
		)
		.input(blockReadinessInputSchema)
		.output(blockReadinessResponseSchema),
	prepareAssetAgain: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/blocks/{blockId}/assets/{assetId}/prepare-again",
				summary: "Retry a failed asset in a repository",
			}),
		)
		.input(prepareRepositoryAssetAgainInputSchema)
		.output(prepareRepositoryAssetAgainResponseSchema),
	prepareFailedAgain: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/blocks/{blockId}/assets/prepare-failed-again",
				summary: "Retry every failed asset in a repository",
			}),
		)
		.input(prepareRepositoryFailedAgainInputSchema)
		.output(prepareRepositoryFailedAgainResponseSchema),
};
