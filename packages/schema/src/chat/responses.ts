import { z } from "zod/v4";
import { chatBranchSchema } from "../chat-branch";
import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
	zedTokenSchema,
} from "../shared";
import { chatSchema } from "./schema";

export const listChatsResponseSchema = createListResponseSchema(chatSchema);

export const findChatResponseSchema = createDataResponseSchema(
	chatSchema.extend({
		branches: z.array(chatBranchSchema),
	}),
);

export const createChatResponseSchema = createDataResponseSchema(
	chatSchema,
).extend({
	meta: zedTokenSchema.optional(),
});

export const updateChatResponseSchema = createDataResponseSchema(chatSchema);

export const deleteChatResponseSchema = createDeleteResponseSchema();
