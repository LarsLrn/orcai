import {
	attachChatBlockInputSchema,
	attachChatBlockResponseSchema,
	detachChatBlockInputSchema,
	detachChatBlockResponseSchema,
	listChatBlocksInputSchema,
	listChatBlocksResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Chat blocks",
		],
	}),
);

export const chatBlockContracts = {
	list: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/chats/{chatId}/blocks",
				summary: "List blocks attached to a chat",
			}),
		)
		.input(listChatBlocksInputSchema)
		.output(listChatBlocksResponseSchema),
	attach: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/chats/{chatId}/blocks",
				summary: "Attach a block to a chat",
			}),
		)
		.input(attachChatBlockInputSchema)
		.output(attachChatBlockResponseSchema),
	detach: tagged
		.meta(
			openapi({
				method: "DELETE",
				path: "/chats/{chatId}/blocks/{blockId}",
				summary: "Detach a block from a chat",
			}),
		)
		.input(detachChatBlockInputSchema)
		.output(detachChatBlockResponseSchema),
};
