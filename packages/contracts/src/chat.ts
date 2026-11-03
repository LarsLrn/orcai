import {
	branchChatInputSchema,
	branchChatResponseSchema,
	createChatInputSchema,
	createChatResponseSchema,
	defaultChatModelInputSchema,
	defaultChatModelResponseSchema,
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

const tagged = base.meta(
	openapi({
		tags: [
			"Chats",
		],
	}),
);

export const chatContracts = {
	list: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/chats",
				summary: "List all chats",
			}),
		)
		.input(listChatsInputSchema)
		.output(listChatsResponseSchema),
	history: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/chat-history",
				summary:
					"List your chats in organisations you are no longer a member of",
			}),
		)
		.input(listChatHistoryInputSchema)
		.output(listChatHistoryResponseSchema),
	create: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/chats",
				summary: "Create a chat",
			}),
		)
		.input(createChatInputSchema)
		.output(createChatResponseSchema),
	defaultModel: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/chat-default-model",
				summary: "Find the model a new chat starts on",
			}),
		)
		.input(defaultChatModelInputSchema)
		.output(defaultChatModelResponseSchema),
	find: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/chats/{id}",
				summary: "Find a chat",
			}),
		)
		.input(findChatInputSchema)
		.output(findChatResponseSchema),
	update: tagged
		.meta(
			openapi({
				method: "PUT",
				path: "/chats/{id}",
				summary: "Update a chat",
			}),
		)
		.input(updateChatInputSchema)
		.output(updateChatResponseSchema),
	pin: tagged
		.meta(
			openapi({
				method: "PUT",
				path: "/chats/{id}/pin",
				summary: "Pin or unpin a chat",
			}),
		)
		.input(pinChatInputSchema)
		.output(pinChatResponseSchema),
	delete: tagged
		.meta(
			openapi({
				method: "DELETE",
				path: "/chats",
				summary: "Delete a chat",
			}),
		)
		.input(deleteChatInputSchema)
		.output(deleteChatResponseSchema),
	branch: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/chats/{chatId}/branches",
				summary: "Branch a chat from one of its messages",
			}),
		)
		.input(branchChatInputSchema)
		.output(branchChatResponseSchema),
};
