import { z } from "zod/v4";
import { baseBlockSelectSchema } from "@/lib/orpc/schemas/block";
import { botDeleteSchema, botSelectSchema } from "@/lib/orpc/schemas/bot";
import {
	botEditorFindSchema,
	botEditorPublishSchema,
	botEditorSaveSchema,
	botEditorSelectSchema,
} from "@/lib/orpc/schemas/bot-editor";
import {
	paginationSchema,
	statusSchema,
	zedTokenSchema,
} from "@/lib/orpc/schemas/shared";
import { base } from "./base";

export const listBotsContract = base
	.route({
		method: "POST",
		path: "/bots",
		summary: "List all bots",
		tags: [
			"Bots",
		],
	})
	.input(
		z.object({
			...paginationSchema.shape,
			...zedTokenSchema.shape,
			search: z.string().optional(),
		}),
	)
	.output(
		z.object({
			data: z.array(botSelectSchema),
			rowCount: z.number(),
		}),
	);

export const findBotContract = base
	.route({
		method: "GET",
		path: "/bots/{id}",
		summary: "Find a bot",
		tags: [
			"Bots",
		],
	})
	.input(
		z.object({
			...botSelectSchema.pick({
				id: true,
			}).shape,
			...zedTokenSchema.shape,
		}),
	)
	.output(
		z.object({
			data: botSelectSchema.extend({
				blockIds: z.array(baseBlockSelectSchema.shape.id),
			}),
		}),
	);

export const findBotEditorContract = base
	.route({
		method: "GET",
		path: "/bots/{id}/editor",
		summary: "Find an editable bot authoring graph",
		tags: [
			"Bots",
		],
	})
	.input(botEditorFindSchema)
	.output(
		z.object({
			data: botEditorSelectSchema,
		}),
	);

export const saveBotContract = base
	.route({
		method: "PUT",
		path: "/bots/save",
		summary: "Create or update a bot authoring graph",
		tags: [
			"Bots",
		],
	})
	.input(botEditorSaveSchema)
	.output(
		z.object({
			data: botEditorSelectSchema,
			meta: zedTokenSchema.optional(),
		}),
	);

export const publishBotContract = base
	.route({
		method: "POST",
		path: "/bots/{id}/publish",
		summary: "Publish a draft bot",
		tags: [
			"Bots",
		],
	})
	.input(botEditorPublishSchema)
	.output(
		z.object({
			data: botEditorSelectSchema,
		}),
	);

export const listDraftBotsContract = base
	.route({
		method: "POST",
		path: "/bots/drafts",
		summary: "List draft bots",
		tags: [
			"Bots",
		],
	})
	.input(
		z.object({
			...paginationSchema.shape,
			...zedTokenSchema.shape,
			search: z.string().optional(),
		}),
	)
	.output(
		z.object({
			data: z.array(botSelectSchema),
			rowCount: z.number(),
		}),
	);

export const deleteBotContract = base
	.route({
		method: "DELETE",
		path: "/bots",
		summary: "Delete a bot",
		tags: [
			"Bots",
		],
	})
	.input(botDeleteSchema)
	.output(statusSchema);
