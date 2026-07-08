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
};
