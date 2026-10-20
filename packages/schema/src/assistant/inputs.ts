import { z } from "zod/v4";
import { paginationInputSchema, zedTokenSchema } from "../shared";

export const listAssistantConversationsInputSchema =
	paginationInputSchema.extend({
		...zedTokenSchema.shape,
	});

export const createAssistantConversationInputSchema = z.object({});

export type ListAssistantConversationsInput = z.infer<
	typeof listAssistantConversationsInputSchema
>;
export type CreateAssistantConversationInput = z.infer<
	typeof createAssistantConversationInputSchema
>;
