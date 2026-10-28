import {
	branchChatInputSchema,
	branchChatResponseSchema,
	createChatInputSchema,
	createChatResponseSchema,
	deleteChatInputSchema,
	deleteChatResponseSchema,
	findChatInputSchema,
	findChatResponseSchema,
	listChatHistoryInputSchema,
	listChatHistoryResponseSchema,
	listChatsInputSchema,
	listChatsResponseSchema,
	pinChatInputSchema,
	pinChatResponseSchema,
	updateChatInputSchema,
	updateChatResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const chatContracts = {
	list: base
		.meta(
			openapi({
				method: "GET",
				path: "/chats",
				summary: "List all chats",
				tags: [
					"Chats",
				],
			}),
		)
		.input(listChatsInputSchema)
		.output(listChatsResponseSchema),
	history: base
		.meta(
			openapi({
				method: "GET",
				path: "/chat-history",
				summary:
					"List your chats in organisations you are no longer a member of",
				tags: [
					"Chats",
				],
			}),
		)
		.input(listChatHistoryInputSchema)
		.output(listChatHistoryResponseSchema),
	create: base
		.meta(
			openapi({
				method: "POST",
				path: "/chats",
				summary: "Create a chat",
				tags: [
					"Chats",
				],
			}),
		)
		.input(createChatInputSchema)
		.output(createChatResponseSchema),
	find: base
		.meta(
			openapi({
				method: "GET",
				path: "/chats/{id}",
				summary: "Find a chat",
				tags: [
					"Chats",
				],
			}),
		)
		.input(findChatInputSchema)
		.output(findChatResponseSchema),
	update: base
		.meta(
			openapi({
				method: "PUT",
				path: "/chats/{id}",
				summary: "Update a chat",
				tags: [
					"Chats",
				],
			}),
		)
		.input(updateChatInputSchema)
		.output(updateChatResponseSchema),
	pin: base
		.meta(
			openapi({
				method: "PUT",
				path: "/chats/{id}/pin",
				summary: "Pin or unpin a chat",
				tags: [
					"Chats",
				],
			}),
		)
		.input(pinChatInputSchema)
		.output(pinChatResponseSchema),
	delete: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/chats",
				summary: "Delete a chat",
				tags: [
					"Chats",
				],
			}),
		)
		.input(deleteChatInputSchema)
		.output(deleteChatResponseSchema),
	branch: base
		.meta(
			openapi({
				method: "POST",
				path: "/chats/{chatId}/branches",
				summary: "Branch a chat from one of its messages",
				tags: [
					"Chats",
				],
			}),
		)
		.input(branchChatInputSchema)
		.output(branchChatResponseSchema),
};
