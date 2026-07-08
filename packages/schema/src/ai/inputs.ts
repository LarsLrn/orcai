import { z } from "zod/v4";
import { chatIdSchema } from "../chat/ref";
import { chatBranchIdSchema } from "../chat-branch/ref";
import { zedTokenSchema } from "../shared";
import { aiChatMessageSchema } from "./schema";

export const aiChatInputSchema = z.object({
	chatId: chatIdSchema,
	messages: z.array(aiChatMessageSchema),
	branchId: chatBranchIdSchema.optional(),
	...zedTokenSchema.shape,
});

export type AiChatInput = z.infer<typeof aiChatInputSchema>;
