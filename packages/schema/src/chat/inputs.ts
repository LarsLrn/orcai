import { z } from "zod/v4";
import { chatMessageIdSchema } from "../chat-message/ref";
import { modelIdSchema } from "../model/ref";
import { paginationInputSchema, zedTokenSchema } from "../shared";
import { createUniqueRefsInputSchema } from "../shared/ref-list";
import { createSortingInputSchema } from "../shared/sorting";
import { chatConfigPatchSchema } from "./parts/config";
import { chatIdSchema } from "./ref";
import { chatFiltersSchema, chatMutableFieldsSchema } from "./schema";

export const chatSortKeySchema = z.enum([
	"title",
	"botName",
	"updatedAt",
]);

export const listChatsInputSchema = paginationInputSchema.extend({
	...zedTokenSchema.shape,
	...createSortingInputSchema(chatSortKeySchema).shape,
	filters: chatFiltersSchema.optional(),
});

export const listChatHistoryInputSchema = paginationInputSchema;

export const findChatInputSchema = z.object({
	id: chatIdSchema,
	...zedTokenSchema.shape,
});

export const createChatInputSchema = chatMutableFieldsSchema;

export const defaultChatModelInputSchema = z.object({
	/** The model the chat's bot recommends. */
	recommendedModelId: modelIdSchema.optional(),
});

export const updateChatInputSchema = chatMutableFieldsSchema.extend({
	config: chatConfigPatchSchema.nullable().optional(),
	id: chatIdSchema,
});

export const pinChatInputSchema = z.object({
	id: chatIdSchema,
	pinned: z.boolean(),
});

export const deleteChatInputSchema = z.object({
	refs: createUniqueRefsInputSchema({
		key: "id",
		value: chatIdSchema,
	}),
});

export const branchChatInputSchema = z.object({
	chatId: chatIdSchema,
	messageId: chatMessageIdSchema,
	...zedTokenSchema.shape,
});

export type ListChatsInput = z.infer<typeof listChatsInputSchema>;
export type ChatSortKey = z.infer<typeof chatSortKeySchema>;
export type ListChatHistoryInput = z.infer<typeof listChatHistoryInputSchema>;
export type FindChatInput = z.infer<typeof findChatInputSchema>;
export type CreateChatInput = z.infer<typeof createChatInputSchema>;
export type DefaultChatModelInput = z.infer<typeof defaultChatModelInputSchema>;
export type UpdateChatInput = z.infer<typeof updateChatInputSchema>;
export type PinChatInput = z.infer<typeof pinChatInputSchema>;
export type DeleteChatInput = z.infer<typeof deleteChatInputSchema>;
export type BranchChatInput = z.infer<typeof branchChatInputSchema>;
