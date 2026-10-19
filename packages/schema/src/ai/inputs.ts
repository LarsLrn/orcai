import { z } from "zod/v4";
import { chatIdSchema } from "../chat/ref";
import { zedTokenSchema } from "../shared";
import { aiChatMessageSchema } from "./schema";

export const aiChatInputSchema = z.object({
	chatId: chatIdSchema,
	message: aiChatMessageSchema,
	...zedTokenSchema.shape,
});

export type AiChatInput = z.infer<typeof aiChatInputSchema>;
