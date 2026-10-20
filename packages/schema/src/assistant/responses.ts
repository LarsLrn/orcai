import { chatSchema } from "../chat/schema";
import { createDataResponseSchema, createListResponseSchema } from "../shared";

export const listAssistantConversationsResponseSchema =
	createListResponseSchema(chatSchema);

export const createAssistantConversationResponseSchema =
	createDataResponseSchema(chatSchema);
