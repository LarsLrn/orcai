import { z } from "zod/v4";
import { chatIdSchema } from "../chat/ref";
import { chatMessageIdSchema } from "../chat-message/ref";
import { zedTokenSchema } from "../shared";
import { aiChatMessageSchema } from "./schema";

export const aiChatInputSchema = z.object({
	chatId: chatIdSchema,
	message: aiChatMessageSchema,
	...zedTokenSchema.shape,
});

export type AiChatInput = z.infer<typeof aiChatInputSchema>;

export const toolApprovalDecisionSchema = z.object({
	approvalId: z.string().min(1).max(200),
	approved: z.boolean(),
	reason: z.string().max(1000).optional(),
});

export type ToolApprovalDecision = z.infer<typeof toolApprovalDecisionSchema>;

export const continueChatInputSchema = z.object({
	chatId: chatIdSchema,
	messageId: chatMessageIdSchema,
	approvals: z.array(toolApprovalDecisionSchema).max(20),
	...zedTokenSchema.shape,
});

export type ContinueChatInput = z.infer<typeof continueChatInputSchema>;
