import {
	createBlockInputSchema,
	createBlockResponseSchema,
	deleteBlocksInputSchema,
	deleteBlocksResponseSchema,
	findBlockInputSchema,
	findBlockResponseSchema,
	listBlocksInputSchema,
	listBlocksResponseSchema,
	updateBlockInputSchema,
	updateBlockResponseSchema,
} from "@orcai/schema";
import { base } from "./base";

export const blockContracts = {
	list: base
		.route({
			method: "GET",
			path: "/blocks",
			summary: "List all blocks",
			tags: [
				"Blocks",
			],
		})
		.input(listBlocksInputSchema)
		.output(listBlocksResponseSchema),
	create: base
		.route({
			method: "POST",
			path: "/blocks",
			summary: "Create a block",
			tags: [
				"Blocks",
			],
		})
		.input(createBlockInputSchema)
		.output(createBlockResponseSchema),
	find: base
		.route({
			method: "GET",
			path: "/blocks/{id}",
			summary: "Find a block",
			tags: [
				"Blocks",
			],
		})
		.input(findBlockInputSchema)
		.output(findBlockResponseSchema),
	update: base
		.route({
			method: "PUT",
			path: "/blocks/{id}",
			summary: "Update a block",
			tags: [
				"Blocks",
			],
		})
		.input(updateBlockInputSchema)
		.output(updateBlockResponseSchema),
	delete: base
		.route({
			method: "DELETE",
			path: "/blocks",
			summary: "Delete blocks",
			tags: [
				"Blocks",
			],
		})
		.input(deleteBlocksInputSchema)
		.output(deleteBlocksResponseSchema),
};
