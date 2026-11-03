import { chatSchema } from "../chat/schema";
import {
	createDataResponseSchema,
	createListResponseSchema,
} from "../shared/responses";

export const listAssistantConversationsResponseSchema =
	createListResponseSchema(chatSchema);

export const createAssistantConversationResponseSchema =
	createDataResponseSchema(chatSchema);
