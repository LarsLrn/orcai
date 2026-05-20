import { base } from "@orcai/contracts";
import {
	createChatInputSchema,
	createChatResponseSchema,
	deleteChatInputSchema,
	deleteChatResponseSchema,
	findChatInputSchema,
	findChatResponseSchema,
	listChatsInputSchema,
	listChatsResponseSchema,
	updateChatInputSchema,
	updateChatResponseSchema,
} from "@orcai/schema";

export const chatContracts = {
	list: base
		.route({
			method: "GET",
			path: "/chats",
			summary: "List all chats",
			tags: [
				"Chats",
			],
		})
		.input(listChatsInputSchema)
		.output(listChatsResponseSchema),
	create: base
		.route({
			method: "POST",
			path: "/chats",
			summary: "Create a chat",
			tags: [
				"Chats",
			],
		})
		.input(createChatInputSchema)
		.output(createChatResponseSchema),
	find: base
		.route({
			method: "GET",
			path: "/chats/{id}",
			summary: "Find a chat",
			tags: [
				"Chats",
			],
		})
		.input(findChatInputSchema)
		.output(findChatResponseSchema),
	update: base
		.route({
			method: "PUT",
			path: "/chats/{id}",
			summary: "Update a chat",
			tags: [
				"Chats",
			],
		})
		.input(updateChatInputSchema)
		.output(updateChatResponseSchema),
	delete: base
		.route({
			method: "DELETE",
			path: "/chats",
			summary: "Delete a chat",
			tags: [
				"Chats",
			],
		})
		.input(deleteChatInputSchema)
		.output(deleteChatResponseSchema),
};
