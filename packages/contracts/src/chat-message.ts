import {
	findChatMessageInputSchema,
	findChatMessageResponseSchema,
	listChatMessageRatingsInputSchema,
	listChatMessageRatingsResponseSchema,
	listChatMessagesInputSchema,
	listChatMessagesResponseSchema,
	rateChatMessageInputSchema,
	rateChatMessageResponseSchema,
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
	listRatings: base
		.meta(
			openapi({
				method: "GET",
				path: "/chats/{chatId}/ratings",
				summary: "List the current user's message ratings in a chat",
				tags: [
					"Chat Messages",
				],
			}),
		)
		.input(listChatMessageRatingsInputSchema)
		.output(listChatMessageRatingsResponseSchema),
	rate: base
		.meta(
			openapi({
				method: "POST",
				path: "/chats/{chatId}/messages/{id}/rate",
				summary: "Rate a chat message, or clear the rating with null",
				tags: [
					"Chat Messages",
				],
			}),
		)
		.input(rateChatMessageInputSchema)
		.output(rateChatMessageResponseSchema),
};
