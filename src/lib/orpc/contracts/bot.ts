import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { botTable } from "@/db/schema/bot";
import { blockSelectSchema } from "../schemas/block";
import { paginationSchema } from "../schemas/shared";
import { base } from "./base";

export const botSelectSchema = createSelectSchema(botTable);

export const botInsertSchema = createInsertSchema(botTable)
	.omit({
		userId: true,
		createdAt: true,
		updatedAt: true,
	})
	.extend({
		name: z.string().min(1, "Bot name is required"),
		description: z.string().min(1, "Bot description is required"),
		blocks: z
			.array(blockSelectSchema)
			.min(1, "At least one active block is required"),
	});

export const botUpdateSchema = createUpdateSchema(botTable, {
	id: z.uuidv4(),
}).extend({
	blocks: z.array(blockSelectSchema.pick({ id: true, name: true, type: true })),
});

export const botDeleteSchema = z.object({
	refs: z.array(botUpdateSchema.pick({ id: true })),
});

export type BotInsert = z.infer<typeof botInsertSchema>;
export type BotUpdate = z.infer<typeof botUpdateSchema>;

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
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));
