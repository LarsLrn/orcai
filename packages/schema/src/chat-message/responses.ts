import { z } from "zod/v4";
import { chatIdSchema } from "../chat/ref";
import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	statusResponseSchema,
} from "../shared";
import { chatMessageIdSchema } from "./ref";
import { chatMessageSchema } from "./schema";

/** One page in ascending `position` order. */
export const listChatMessagesResponseSchema = z.object({
	data: z.array(chatMessageSchema),
	hasMore: z.boolean(),
});

export const createChatMessageResponseSchema =
	createDataResponseSchema(chatMessageSchema);

export const findChatMessageResponseSchema =
	createDataResponseSchema(chatMessageSchema);

export const deleteChatMessagesResponseSchema = createDeleteResponseSchema();

export const rateChatMessageResponseSchema = createDataResponseSchema(
	z.object({
		id: chatMessageIdSchema,
		chatId: chatIdSchema,
		sentiment: z.number().min(1).max(5),
	}),
).extend({
	...statusResponseSchema.shape,
});
