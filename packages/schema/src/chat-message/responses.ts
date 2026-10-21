import { z } from "zod/v4";
import { createDataResponseSchema } from "../shared";
import { chatMessageIdSchema } from "./ref";
import { chatMessageRatingSchema, chatMessageSchema } from "./schema";

/** One page in ascending `position` order. */
export const listChatMessagesResponseSchema = z.object({
	data: z.array(chatMessageSchema),
	hasMore: z.boolean(),
});

export const findChatMessageResponseSchema =
	createDataResponseSchema(chatMessageSchema);

/** The signed-in user's ratings in a chat; unrated messages are absent. */
export const listChatMessageRatingsResponseSchema = createDataResponseSchema(
	z.array(
		z.object({
			messageId: chatMessageIdSchema,
			rating: chatMessageRatingSchema,
		}),
	),
);

export const rateChatMessageResponseSchema = createDataResponseSchema(
	z.object({
		messageId: chatMessageIdSchema,
		rating: chatMessageRatingSchema.nullable(),
	}),
);
