import { z } from "zod/v4";
import { chatIdSchema } from "../chat/schema";
import { chatBranchIdSchema } from "../chat-branch";
import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
	statusResponseSchema,
} from "../shared";
import { chatMessageIdSchema, chatMessageSchema } from "./schema";

export const chatMessageScoresSchema = createDataResponseSchema(
	z.array(z.unknown()),
).extend({
	meta: z.object({
		page: z.number(),
		totalItems: z.number(),
		limit: z.number(),
		totalPages: z.number(),
	}),
});

export const listChatMessagesResponseSchema = createListResponseSchema(
	chatMessageSchema,
).extend({
	scores: chatMessageScoresSchema,
});

export const createChatMessageResponseSchema = createDataResponseSchema(
	chatMessageSchema,
).extend({
	branchId: chatBranchIdSchema.optional(),
});

export const findChatMessageResponseSchema =
	createDataResponseSchema(chatMessageSchema);

export const updateChatMessageResponseSchema = createDataResponseSchema(
	chatMessageSchema,
).extend({
	branchId: chatBranchIdSchema.optional(),
});

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

export const getBranchIdForMessageResponseSchema = z.object({
	branchId: chatBranchIdSchema,
});
