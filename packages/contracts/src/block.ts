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

export const blockContracts = {
	list: base
		.meta(
			openapi({
				method: "GET",
				path: "/blocks",
				summary: "List all blocks",
				tags: [
					"Blocks",
				],
			}),
		)
		.input(listBlocksInputSchema)
		.output(listBlocksResponseSchema),
	create: base
		.meta(
			openapi({
				method: "POST",
				path: "/blocks",
				summary: "Create a block",
				tags: [
					"Blocks",
				],
			}),
		)
		.input(createBlockInputSchema)
		.output(createBlockResponseSchema),
	find: base
		.meta(
			openapi({
				method: "GET",
				path: "/blocks/{id}",
				summary: "Find a block",
				tags: [
					"Blocks",
				],
			}),
		)
		.input(findBlockInputSchema)
		.output(findBlockResponseSchema),
	update: base
		.meta(
			openapi({
				method: "PUT",
				path: "/blocks/{id}",
				summary: "Update a block",
				tags: [
					"Blocks",
				],
			}),
		)
		.input(updateBlockInputSchema)
		.output(updateBlockResponseSchema),
	delete: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/blocks",
				summary: "Delete blocks",
				tags: [
					"Blocks",
				],
			}),
		)
		.input(deleteBlocksInputSchema)
		.output(deleteBlocksResponseSchema),
	readiness: base
		.meta(
			openapi({
				method: "POST",
				path: "/blocks/readiness",
				summary: "Asset readiness of repositories",
				tags: [
					"Blocks",
				],
			}),
		)
		.input(blockReadinessInputSchema)
		.output(blockReadinessResponseSchema),
	prepareAssetAgain: base
		.meta(
			openapi({
				method: "POST",
				path: "/blocks/{blockId}/assets/{assetId}/prepare-again",
				summary: "Retry a failed asset in a repository",
				tags: [
					"Blocks",
				],
			}),
		)
		.input(prepareRepositoryAssetAgainInputSchema)
		.output(prepareRepositoryAssetAgainResponseSchema),
	prepareFailedAgain: base
		.meta(
			openapi({
				method: "POST",
				path: "/blocks/{blockId}/assets/prepare-failed-again",
				summary: "Retry every failed asset in a repository",
				tags: [
					"Blocks",
				],
			}),
		)
		.input(prepareRepositoryFailedAgainInputSchema)
		.output(prepareRepositoryFailedAgainResponseSchema),
};
