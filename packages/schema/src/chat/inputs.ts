import { z } from "zod/v4";
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

export const findChatInputSchema = z.object({
	id: chatIdSchema,
	...zedTokenSchema.shape,
});

export const createChatInputSchema = chatMutableFieldsSchema;

export const updateChatInputSchema = chatMutableFieldsSchema.extend({
	config: chatConfigPatchSchema.nullable().optional(),
	id: chatIdSchema,
});

export const deleteChatInputSchema = z.object({
	refs: createUniqueRefsInputSchema({
		key: "id",
		value: chatIdSchema,
		entityName: "chat",
	}),
});

export type ListChatsInput = z.infer<typeof listChatsInputSchema>;
export type ChatSortKey = z.infer<typeof chatSortKeySchema>;
export type FindChatInput = z.infer<typeof findChatInputSchema>;
export type CreateChatInput = z.infer<typeof createChatInputSchema>;
export type UpdateChatInput = z.infer<typeof updateChatInputSchema>;
export type DeleteChatInput = z.infer<typeof deleteChatInputSchema>;
