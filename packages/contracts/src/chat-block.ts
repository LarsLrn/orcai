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

export const chatBlockContracts = {
	list: base
		.meta(
			openapi({
				method: "GET",
				path: "/chats/{chatId}/blocks",
				summary: "List blocks attached to a chat",
				tags: [
					"Chat Blocks",
				],
			}),
		)
		.input(listChatBlocksInputSchema)
		.output(listChatBlocksResponseSchema),
	attach: base
		.meta(
			openapi({
				method: "POST",
				path: "/chats/{chatId}/blocks",
				summary: "Attach a block to a chat",
				tags: [
					"Chat Blocks",
				],
			}),
		)
		.input(attachChatBlockInputSchema)
		.output(attachChatBlockResponseSchema),
	detach: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/chats/{chatId}/blocks/{blockId}",
				summary: "Detach a block from a chat",
				tags: [
					"Chat Blocks",
				],
			}),
		)
		.input(detachChatBlockInputSchema)
		.output(detachChatBlockResponseSchema),
};
