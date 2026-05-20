import { z } from "zod/v4";
import { chatBranchIdSchema } from "../chat-branch";
import {
	createDataResponseSchema,
	createDeleteResponseSchema,
} from "../shared";
import { chatMessageSchema } from "./schema";

export const chatMessageScoresSchema = z.object({
	data: z.array(z.unknown()),
	meta: z.object({
		page: z.number(),
		totalItems: z.number(),
		limit: z.number(),
		totalPages: z.number(),
	}),
});

export const listChatMessagesResponseSchema = z.object({
	data: z.array(chatMessageSchema),
	rowCount: z.number(),
	scores: chatMessageScoresSchema,
});

export const createChatMessageResponseSchema = z.object({
	data: chatMessageSchema,
	branchId: chatBranchIdSchema.optional(),
});

export const findChatMessageResponseSchema =
	createDataResponseSchema(chatMessageSchema);

export const updateChatMessageResponseSchema = z.object({
	data: chatMessageSchema,
	branchId: chatBranchIdSchema.optional(),
});

export const deleteChatMessagesResponseSchema = createDeleteResponseSchema();

export const rateChatMessageResponseSchema = z.object({
	success: z.boolean(),
	message: z.string().optional(),
	data: z.object({
		id: chatMessageSchema.shape.id,
		chatId: chatMessageSchema.shape.chatId,
		sentiment: z.number().min(1).max(5),
	}),
});

export const getBranchIdForMessageResponseSchema = z.object({
	branchId: chatBranchIdSchema,
});
