import { z } from "zod/v4";
import { paginationInputSchema, zedTokenSchema } from "../shared";
import { createUniqueRefsInputSchema } from "../shared/ref-list";
import { chatMessageIdSchema } from "./ref";
import { chatMessageFieldsSchema, chatMessageSchema } from "./schema";

export const listChatMessagesInputSchema = z.object({
	...paginationInputSchema.shape,
	...zedTokenSchema.shape,
	chatId: chatMessageSchema.shape.chatId,
	includeScores: z.boolean().default(false),
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

export const deleteChatMessagesInputSchema = z.object({
	chatId: chatMessageSchema.shape.chatId,
	refs: createUniqueRefsInputSchema({
		key: "id",
		value: chatMessageIdSchema,
	}),
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
export type DeleteChatMessagesInput = z.infer<
	typeof deleteChatMessagesInputSchema
>;
export type RateChatMessageInput = z.infer<typeof rateChatMessageInputSchema>;
