import { z } from "zod/v4";
import { zedTokenSchema } from "../shared";
import { chatMessageIdSchema } from "./ref";
import { chatMessageFieldsSchema, chatMessageSchema } from "./schema";

/** The newest `limit` messages below `before`, by `position`. */
export const listChatMessagesInputSchema = z.object({
	...zedTokenSchema.shape,
	chatId: chatMessageSchema.shape.chatId,
	before: z.number().int().nonnegative().optional(),
	limit: z.number().int().min(1).max(100).default(20),
});

export const createChatMessageInputSchema = chatMessageFieldsSchema.extend({
	id: chatMessageIdSchema.optional(),
	attachments: chatMessageFieldsSchema.shape.attachments.optional(),
});

export const findChatMessageInputSchema = z.object({
	chatId: chatMessageSchema.shape.chatId,
	id: chatMessageSchema.shape.id,
	...zedTokenSchema.shape,
});

export const rateChatMessageInputSchema = z.object({
	id: chatMessageSchema.shape.id,
	chatId: chatMessageSchema.shape.chatId,
	sentiment: z.number().min(1).max(5),
});

export type ListChatMessagesInput = z.infer<typeof listChatMessagesInputSchema>;
export type CreateChatMessageInput = z.infer<
	typeof createChatMessageInputSchema
>;
export type FindChatMessageInput = z.infer<typeof findChatMessageInputSchema>;
export type RateChatMessageInput = z.infer<typeof rateChatMessageInputSchema>;
