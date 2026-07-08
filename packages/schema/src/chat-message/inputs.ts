import { z } from "zod/v4";
import { chatBranchIdSchema } from "../chat-branch/ref";
import { paginationInputSchema, zedTokenSchema } from "../shared";
import { createUniqueRefsInputSchema } from "../shared/ref-list";
import { chatMessageIdSchema } from "./ref";
import {
	chatMessageFieldsSchema,
	chatMessageMutableFieldsSchema,
	chatMessageSchema,
} from "./schema";

export const listChatMessagesInputSchema = z.object({
	...paginationInputSchema.shape,
	...zedTokenSchema.shape,
	chatId: chatMessageSchema.shape.chatId,
	includeScores: z.boolean().default(false),
	branchId: chatBranchIdSchema,
});

export const createChatMessageInputSchema = chatMessageFieldsSchema
	.extend({
		id: chatMessageIdSchema.optional(),
		parentMessageId: chatMessageIdSchema.nullable().optional(),
		attachments: chatMessageFieldsSchema.shape.attachments.optional(),
		branchId: chatBranchIdSchema.optional(),
	})
	.omit({
		depth: true,
	});

export const findChatMessageInputSchema = z.object({
	chatId: chatMessageSchema.shape.chatId,
	id: chatMessageSchema.shape.id,
	...zedTokenSchema.shape,
});

export const updateChatMessageInputSchema =
	chatMessageMutableFieldsSchema.extend({
		id: chatMessageSchema.shape.id,
		chatId: chatMessageSchema.shape.chatId,
		branchId: chatBranchIdSchema.optional(),
	});

export const deleteChatMessagesInputSchema = z.object({
	chatId: chatMessageSchema.shape.chatId,
	refs: createUniqueRefsInputSchema({
		key: "id",
		value: chatMessageIdSchema,
		entityName: "message",
	}),
});

export const rateChatMessageInputSchema = z.object({
	id: chatMessageSchema.shape.id,
	chatId: chatMessageSchema.shape.chatId,
	sentiment: z.number().min(1).max(5),
});

export const getBranchIdForMessageInputSchema = z.object({
	messageId: chatMessageSchema.shape.id,
	chatId: chatMessageSchema.shape.chatId,
});

export type ListChatMessagesInput = z.infer<typeof listChatMessagesInputSchema>;
export type CreateChatMessageInput = z.infer<
	typeof createChatMessageInputSchema
>;
export type FindChatMessageInput = z.infer<typeof findChatMessageInputSchema>;
export type UpdateChatMessageInput = z.infer<
	typeof updateChatMessageInputSchema
>;
export type DeleteChatMessagesInput = z.infer<
	typeof deleteChatMessagesInputSchema
>;
export type RateChatMessageInput = z.infer<typeof rateChatMessageInputSchema>;
export type GetBranchIdForMessageInput = z.infer<
	typeof getBranchIdForMessageInputSchema
>;
