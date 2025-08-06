import { z } from "zod/v4";
import {
	chatDeleteSchema,
	chatInsertSchema,
	chatSelectSchema,
	chatUpdateSchema,
} from "@/lib/orpc/schemas/chat";
import { paginationSchema } from "@/lib/orpc/schemas/shared";
import { base } from "./base";

export const listChatsContract = base
	.route({
		method: "GET",
		path: "/chats",
		summary: "List all chats",
		tags: ["Chats"],
	})
	.input(paginationSchema)
	.output(z.object({ data: z.array(chatSelectSchema), rowCount: z.number() }));

export const createChatContract = base
	.route({
		method: "POST",
		path: "/chats",
		summary: "Create a chat",
		tags: ["Chats"],
	})
	.input(chatInsertSchema)
	.output(z.object({ data: chatSelectSchema }));

export const findChatContract = base
	.route({
		method: "GET",
		path: "/chats/{id}",
		summary: "Find a chat",
		tags: ["Chats"],
	})
	.input(chatSelectSchema.pick({ id: true }))
	.output(z.object({ data: chatSelectSchema }));

export const updateChatContract = base
	.route({
		method: "PUT", //TODO:Probably should be PATCH
		path: "/chats/{id}",
		summary: "Update a chat",
		tags: ["Chats"],
	})
	.errors({
		NOT_FOUND: {
			message: "Chat not found",
			data: z.object({ id: chatUpdateSchema.shape.id }),
		},
	})
	.input(chatUpdateSchema)
	.output(z.object({ data: chatSelectSchema }));

export const deleteChatContract = base
	.route({
		method: "DELETE",
		path: "/chats",
		summary: "Delete a chat",
		tags: ["Chats"],
	})
	.input(chatDeleteSchema)
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));
