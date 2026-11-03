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

const tagged = base.meta(
	openapi({
		tags: [
			"Chat messages",
		],
	}),
);

export const chatMessageContracts = {
	list: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/chats/{chatId}/messages",
				summary: "List all messages in a chat",
			}),
		)
		.input(listChatMessagesInputSchema)
		.output(listChatMessagesResponseSchema),
	find: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/chats/{chatId}/messages/{id}",
				summary: "Find a chat message",
			}),
		)
		.input(findChatMessageInputSchema)
		.output(findChatMessageResponseSchema),
	listRatings: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/chats/{chatId}/ratings",
				summary: "List the current user's message ratings in a chat",
			}),
		)
		.input(listChatMessageRatingsInputSchema)
		.output(listChatMessageRatingsResponseSchema),
	rate: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/chats/{chatId}/messages/{id}/rate",
				summary: "Rate a chat message, or clear the rating with null",
			}),
		)
		.input(rateChatMessageInputSchema)
		.output(rateChatMessageResponseSchema),
};
