import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
} from "../shared";
import { chatListRowSchema, chatSchema } from "./schema";

export const listChatsResponseSchema =
	createListResponseSchema(chatListRowSchema);

export const findChatResponseSchema = createDataResponseSchema(chatSchema);

export const createChatResponseSchema = createDataResponseSchema(chatSchema);

export const updateChatResponseSchema = createDataResponseSchema(chatSchema);

export const deleteChatResponseSchema = createDeleteResponseSchema();
