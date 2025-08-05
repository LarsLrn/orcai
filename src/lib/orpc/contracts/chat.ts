import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { chat } from "@/db/schema/chat";
import { paginationSchema } from "../schemas/shared";
import { base } from "./base";

export const chatSelectSchema = createSelectSchema(chat);

export const chatInsertSchema = createInsertSchema(chat).omit({
	userId: true,
	createdAt: true,
	updatedAt: true,
	id: true,
});

export const chatUpdateSchema = createUpdateSchema(chat, {
	id: z.uuidv4(),
	title: z.string().min(1).max(250),
}).omit({ userId: true, updatedAt: true, createdAt: true });

export const chatDeleteSchema = z.object({
	refs: z.array(chatUpdateSchema.pick({ id: true })),
});

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
