import { z } from "zod/v4";
import {
	chatMessageDeleteSchema,
	chatMessageInsertSchema,
	chatMessageSelectSchema,
	chatMessageUpdateSchema,
} from "@/lib/orpc/schemas/chat-message";
import { paginationSchema, statusSchema } from "@/lib/orpc/schemas/shared";
import { base } from "./base";

export const listChatMessagesContract = base
	.route({
		method: "GET",
		path: "/chats/{chatId}/messages",
		summary: "List all messages in a chat",
		tags: ["Chat Messages"],
	})
	.input(
		paginationSchema.extend({
			chatId: chatMessageSelectSchema.shape.chatId,
			includeScores: z.boolean().default(false),
		}),
	)
	.output(
		z.object({
			data: z.array(chatMessageSelectSchema),
			rowCount: z.number(),
			// TODO: Consider using a more specific type for scores
			scores: z.object({
				data: z.array(z.any()),
				meta: z.object({
					page: z.number(),
					totalItems: z.number(),
					limit: z.number(),
					totalPages: z.number(),
				}),
			}),
		}),
	);

export const createChatMessageContract = base
	.route({
		method: "POST",
		path: "/chats/{chatId}/messages",
		summary: "Create a chat message",
		tags: ["Chat Messages"],
	})
	.input(chatMessageInsertSchema)
	.output(z.object({ data: chatMessageSelectSchema }));

export const findChatMessageContract = base
	.route({
		method: "GET",
		path: "/chats/{chatId}/messages/{id}",
		summary: "Find a chat message",
		tags: ["Chat Messages"],
	})
	.input(chatMessageSelectSchema.pick({ chatId: true, id: true }))
	.output(z.object({ data: chatMessageSelectSchema }));

export const updateChatMessageContract = base
	.route({
		method: "PUT",
		path: "/chats/{chatId}/messages/{id}",
		summary: "Update a chat message",
		tags: ["Chat Messages"],
	})
	.errors({
		NOT_FOUND: {
			message: "Chat not found",
			data: z.object({ id: chatMessageUpdateSchema.shape.id }),
		},
	})
	.input(chatMessageUpdateSchema)
	.output(z.object({ data: chatMessageSelectSchema }));

export const deleteChatMessageContract = base
	.route({
		method: "DELETE",
		path: "/chats/{chatId}/messages",
		summary: "Delete a chat message",
		tags: ["Chat Messages"],
	})
	.input(chatMessageDeleteSchema)
	.output(statusSchema);

export const rateChatMessageContract = base
	.route({
		method: "POST",
		path: "/chats/{chatId}/messages/{id}/rate",
		summary: "Rate a chat message",
		tags: ["Chat Messages"],
	})
	.input(
		z.object({
			id: chatMessageSelectSchema.shape.id,
			chatId: chatMessageSelectSchema.shape.chatId,
			sentiment: z.number().min(1).max(5),
		}),
	)
	.output(
		z.object({
			success: z.boolean(),
			message: z.string().optional(),
			data: z.object({
				id: chatMessageSelectSchema.shape.id,
				chatId: chatMessageSelectSchema.shape.chatId,
				sentiment: z.number().min(1).max(5),
			}),
		}),
	);
