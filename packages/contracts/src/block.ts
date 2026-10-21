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
	retryDocumentInputSchema,
	retryDocumentResponseSchema,
	retryFailedDocumentsInputSchema,
	retryFailedDocumentsResponseSchema,
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
				summary: "Document readiness of repositories",
				tags: [
					"Blocks",
				],
			}),
		)
		.input(blockReadinessInputSchema)
		.output(blockReadinessResponseSchema),
	retryDocument: base
		.meta(
			openapi({
				method: "POST",
				path: "/blocks/{blockId}/documents/{assetId}/retry",
				summary: "Retry a failed document in a repository",
				tags: [
					"Blocks",
				],
			}),
		)
		.input(retryDocumentInputSchema)
		.output(retryDocumentResponseSchema),
	retryFailed: base
		.meta(
			openapi({
				method: "POST",
				path: "/blocks/{blockId}/documents/retry-failed",
				summary: "Retry every failed document in a repository",
				tags: [
					"Blocks",
				],
			}),
		)
		.input(retryFailedDocumentsInputSchema)
		.output(retryFailedDocumentsResponseSchema),
};
