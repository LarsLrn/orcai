import { z } from "zod/v4";
import { chatSelectSchema } from "@/lib/orpc/schemas/chat";
import { chatBranchSelectSchema } from "@/lib/orpc/schemas/chat-branch";
import {
	chatMessageDeleteSchema,
	chatMessageInsertSchema,
	chatMessageSelectSchema,
	chatMessageUpdateSchema,
} from "@/lib/orpc/schemas/chat-message";
import {
	paginationSchema,
	statusSchema,
	zedTokenSchema,
} from "@/lib/orpc/schemas/shared";
import { base } from "./base";

export const listChatMessagesContract = base
	.route({
		method: "GET",
		path: "/chats/{chatId}/messages",
		summary: "List all messages in a chat",
		tags: [
			"Chat Messages",
		],
	})
	.input(
		z.object({
			...paginationSchema.shape,
			...zedTokenSchema.shape,
			chatId: chatMessageSelectSchema.shape.chatId,
			includeScores: z.boolean().default(false),
			branchId: chatBranchSelectSchema.shape.id,
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
		tags: [
			"Chat Messages",
		],
	})
	.input(
		chatMessageInsertSchema.extend({
			branchId: chatBranchSelectSchema.shape.id.optional(),
		}),
	)
	.output(
		z.object({
			data: chatMessageSelectSchema,
			branchId: chatBranchSelectSchema.shape.id.optional(),
		}),
	);

export const findChatMessageContract = base
	.route({
		method: "GET",
		path: "/chats/{chatId}/messages/{id}",
		summary: "Find a chat message",
		tags: [
			"Chat Messages",
		],
	})
	.input(
		z.object({
			chatId: chatMessageSelectSchema.shape.chatId,
			id: chatMessageSelectSchema.shape.id,
			...zedTokenSchema.shape,
		}),
	)
	.output(
		z.object({
			data: chatMessageSelectSchema,
		}),
	);

export const updateChatMessageContract = base
	.route({
		method: "PUT",
		path: "/chats/{chatId}/messages/{id}",
		summary: "Update a chat message",
		tags: [
			"Chat Messages",
		],
	})
	.errors({
		NOT_FOUND: {
			message: "Chat not found",
			data: z.object({
				id: chatMessageUpdateSchema.shape.id,
			}),
		},
	})
	.input(
		chatMessageUpdateSchema.extend({
			branchId: chatBranchSelectSchema.shape.id.optional(),
		}),
	)
	.output(
		z.object({
			data: chatMessageSelectSchema,
			branchId: chatBranchSelectSchema.shape.id.optional(),
		}),
	);

export const deleteChatMessageContract = base
	.route({
		method: "DELETE",
		path: "/chats/{chatId}/messages",
		summary: "Delete a chat message",
		tags: [
			"Chat Messages",
		],
	})
	.input(chatMessageDeleteSchema)
	.output(statusSchema);

export const rateChatMessageContract = base
	.route({
		method: "POST",
		path: "/chats/{chatId}/messages/{id}/rate",
		summary: "Rate a chat message",
		tags: [
			"Chat Messages",
		],
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

export const getBranchIdForMessageContract = base
	.route({
		method: "GET",
		path: "/chats/{chatId}/messages/{messageId}/branch",
		summary: "Get the branch ID for a message",
		tags: [
			"Chat Messages",
		],
	})
	.input(
		z.object({
			messageId: chatMessageSelectSchema.shape.id,
			chatId: chatSelectSchema.shape.id,
		}),
	)
	.output(
		z.object({
			branchId: chatBranchSelectSchema.shape.id,
		}),
	);
