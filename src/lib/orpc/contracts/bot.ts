import { z } from "zod/v4";
import { blockSelectSchema } from "../schemas/block";
import {
	botDeleteSchema,
	botInsertSchema,
	botSelectSchema,
	botUpdateSchema,
} from "../schemas/bot";
import { paginationSchema, statusSchema } from "../schemas/shared";
import { base } from "./base";

export const listBotsContract = base
	.route({
		method: "GET",
		path: "/bots",
		summary: "List all bots",
		tags: ["Bots"],
	})
	.input(paginationSchema)
	.output(z.object({ data: z.array(botSelectSchema), rowCount: z.number() }));

export const createBotContract = base
	.route({
		method: "POST",
		path: "/bots",
		summary: "Create a bot",
		tags: ["Bots"],
	})
	.input(botInsertSchema)
	.output(
		z.object({
			data: botSelectSchema.extend({ blockIds: z.array(z.uuidv4()) }),
		}),
	);

export const findBotContract = base
	.route({
		method: "GET",
		path: "/bots/{id}",
		summary: "Find a bot",
		tags: ["Bots"],
	})
	.input(botSelectSchema.pick({ id: true }))
	.output(
		z.object({
			data: botSelectSchema.extend({ blocks: z.array(blockSelectSchema) }),
		}),
	);

export const updateBotContract = base
	.route({
		method: "PUT", //TODO:Probably should be PATCH
		path: "/bots/{id}",
		summary: "Update a bot",
		tags: ["Bots"],
	})
	.errors({
		NOT_FOUND: {
			message: "Bot not found",
			data: z.object({ id: botUpdateSchema.shape.id }),
		},
	})
	.input(botUpdateSchema)
	.output(
		z.object({
			data: botSelectSchema.extend({ blockIds: z.array(z.uuidv4()) }),
		}),
	);

export const deleteBotContract = base
	.route({
		method: "DELETE",
		path: "/bots",
		summary: "Delete a bot",
		tags: ["Bots"],
	})
	.input(botDeleteSchema)
	.output(statusSchema);
