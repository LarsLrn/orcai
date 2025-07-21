import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { blockTable } from "@/db/schema/block";
import { base } from "./base";

export const blockSelectSchema = createSelectSchema(blockTable, {
	type: z.enum(["template", "database"]),
});

export const blockInsertSchema = createInsertSchema(blockTable, {
	type: z.enum(["template", "database"]),
}).omit({
	userId: true,
	createdAt: true,
	updatedAt: true,
	id: true,
});

export const blockUpdateSchema = createUpdateSchema(blockTable, {
	id: z.uuidv4(),
	title: z.string().min(1).max(250),
	type: z.enum(["template", "database"]),
}).omit({ userId: true, updatedAt: true, createdAt: true });

export const blockDeleteSchema = z.object({
	refs: z.array(blockUpdateSchema.pick({ id: true })),
});

export const listBlocksContract = base
	.route({
		method: "GET",
		path: "/blocks",
		summary: "List all blocks",
		tags: ["Blocks"],
	})
	.input(
		z.object({
			pageSize: z.number().int().min(1).max(100).default(10),
			pageIndex: z.number().int().min(0).default(0),
		}),
	)
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
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));
