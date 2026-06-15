import { base } from "@orcai/contracts";
import { blockSchema, statusResponseSchema } from "@orcai/schema";
import { z } from "zod/v4";
import {
	chatBlockDeleteSchema,
	chatBlockInsertSchema,
	chatBlockListSchema,
	chatBlockSelectSchema,
} from "@/lib/orpc/schemas/chat-block";

export const listChatBlocksContract = base
	.route({
		method: "GET",
		path: "/chats/{chatId}/blocks",
		summary: "List blocks attached to a chat",
		tags: [
			"Chat Blocks",
		],
	})
	.input(chatBlockListSchema)
	.output(
		z.object({
			data: z.array(blockSchema),
		}),
	);

export const attachChatBlockContract = base
	.route({
		method: "POST",
		path: "/chats/{chatId}/blocks",
		summary: "Attach a block to a chat",
		tags: [
			"Chat Blocks",
		],
	})
	.input(chatBlockInsertSchema)
	.output(
		z.object({
			data: chatBlockSelectSchema,
		}),
	);

export const detachChatBlockContract = base
	.route({
		method: "DELETE",
		path: "/chats/{chatId}/blocks/{blockId}",
		summary: "Detach a block from a chat",
		tags: [
			"Chat Blocks",
		],
	})
	.input(chatBlockDeleteSchema)
	.output(statusResponseSchema);
