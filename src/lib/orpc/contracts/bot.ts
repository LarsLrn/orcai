import { z } from "zod/v4";
import {
	baseBlockSelectSchema,
	blockSelectSchema,
} from "@/lib/orpc/schemas/block";
import {
	botDeleteSchema,
	botInsertSchema,
	botSelectSchema,
	botUpdateSchema,
} from "@/lib/orpc/schemas/bot";
import { paginationSchema, statusSchema } from "@/lib/orpc/schemas/shared";
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
			data: botSelectSchema.extend({
				blockIds: z.array(baseBlockSelectSchema.shape.id),
			}),
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
			data: botSelectSchema.extend({
				blockIds: z.array(baseBlockSelectSchema.shape.id),
			}),
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
			data: botSelectSchema.extend({
				blockIds: z.array(baseBlockSelectSchema.shape.id),
			}),
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
