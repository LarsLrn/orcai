import { z } from "zod/v4";
import {
	blockDeleteSchema,
	blockInsertSchema,
	blockSelectSchema,
	blockUpdateSchema,
} from "../schemas/block";
import { paginationSchema, statusSchema } from "../schemas/shared";
import { base } from "./base";

export const listBlocksContract = base
	.route({
		method: "GET",
		path: "/blocks",
		summary: "List all blocks",
		tags: ["Blocks"],
	})
	.input(paginationSchema)
	.output(z.object({ data: z.array(blockSelectSchema), rowCount: z.number() }));

export const createBlockContract = base
	.route({
		method: "POST",
		path: "/blocks",
		summary: "Create a block",
		tags: ["Blocks"],
	})
	.input(blockInsertSchema)
	.output(z.object({ data: blockSelectSchema }));

export const findBlockContract = base
	.route({
		method: "GET",
		path: "/blocks/{id}",
		summary: "Find a block",
		tags: ["Blocks"],
	})
	.input(blockSelectSchema.pick({ id: true }))
	.output(z.object({ data: blockSelectSchema }));

export const updateBlockContract = base
	.route({
		method: "PUT", //TODO:Probably should be PATCH
		path: "/blocks/{id}",
		summary: "Update a block",
		tags: ["Blocks"],
	})
	.errors({
		NOT_FOUND: {
			message: "Block not found",
			data: z.object({ id: blockUpdateSchema.shape.id }),
		},
	})
	.input(blockUpdateSchema)
	.output(z.object({ data: blockSelectSchema }));

export const deleteBlockContract = base
	.route({
		method: "DELETE",
		path: "/blocks",
		summary: "Delete a block",
		tags: ["Blocks"],
	})
	.input(blockDeleteSchema)
	.output(statusSchema);

export const addAssetsToBlockContract = base
	.route({
		method: "POST",
		path: "/blocks/{id}/assets",
		summary: "Add assets to a block",
		tags: ["Blocks"],
	})
	.input(
		z.object({
			blockId: z.uuidv4(),
			assets: z.array(z.uuidv4()),
		}),
	)
	.output(statusSchema);
