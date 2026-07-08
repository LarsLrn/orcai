import {
	createChatMessageInputSchema,
	createChatMessageResponseSchema,
	deleteChatMessagesInputSchema,
	deleteChatMessagesResponseSchema,
	findChatMessageInputSchema,
	findChatMessageResponseSchema,
	getBranchIdForMessageInputSchema,
	getBranchIdForMessageResponseSchema,
	listChatMessagesInputSchema,
	listChatMessagesResponseSchema,
	rateChatMessageInputSchema,
	rateChatMessageResponseSchema,
	updateChatMessageInputSchema,
	updateChatMessageResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const chatMessageContracts = {
	list: base
		.meta(
			openapi({
				method: "GET",
				path: "/chats/{chatId}/messages",
				summary: "List all messages in a chat",
				tags: [
					"Chat Messages",
				],
			}),
		)
		.input(listChatMessagesInputSchema)
		.output(listChatMessagesResponseSchema),
	create: base
		.meta(
			openapi({
				method: "POST",
				path: "/chats/{chatId}/messages",
				summary: "Create a chat message",
				tags: [
					"Chat Messages",
				],
			}),
		)
		.input(createChatMessageInputSchema)
		.output(createChatMessageResponseSchema),
	find: base
		.meta(
			openapi({
				method: "GET",
				path: "/chats/{chatId}/messages/{id}",
				summary: "Find a chat message",
				tags: [
					"Chat Messages",
				],
			}),
		)
		.input(findChatMessageInputSchema)
		.output(findChatMessageResponseSchema),
	update: base
		.meta(
			openapi({
				method: "PUT",
				path: "/chats/{chatId}/messages/{id}",
				summary: "Update a chat message",
				tags: [
					"Chat Messages",
				],
			}),
		)
		.input(updateChatMessageInputSchema)
		.output(updateChatMessageResponseSchema),
	delete: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/chats/{chatId}/messages",
				summary: "Delete a chat message",
				tags: [
					"Chat Messages",
				],
			}),
		)
		.input(deleteChatMessagesInputSchema)
		.output(deleteChatMessagesResponseSchema),
	rate: base
		.meta(
			openapi({
				method: "POST",
				path: "/chats/{chatId}/messages/{id}/rate",
				summary: "Rate a chat message",
				tags: [
					"Chat Messages",
				],
			}),
		)
		.input(rateChatMessageInputSchema)
		.output(rateChatMessageResponseSchema),
	getBranch: base
		.meta(
			openapi({
				method: "GET",
				path: "/chats/{chatId}/messages/{messageId}/branch",
				summary: "Get the branch ID for a message",
				tags: [
					"Chat Messages",
				],
			}),
		)
		.input(getBranchIdForMessageInputSchema)
		.output(getBranchIdForMessageResponseSchema),
};
