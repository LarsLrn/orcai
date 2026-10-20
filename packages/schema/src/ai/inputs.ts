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

const toolCallIdSchema = z.string().min(1).max(200);

/** A client tool's result; the server validates `output` against that tool's schema. */
export const clientToolOutputSchema = z.union([
	z.strictObject({
		toolCallId: toolCallIdSchema,
		errorText: z.string().min(1).max(1000),
	}),
	z.strictObject({
		toolCallId: toolCallIdSchema,
		output: z.unknown(),
	}),
]);

export type ClientToolOutput = z.infer<typeof clientToolOutputSchema>;

export const continueChatInputSchema = z.object({
	chatId: chatIdSchema,
	messageId: chatMessageIdSchema,
	approvals: z.array(toolApprovalDecisionSchema).max(20),
	toolOutputs: z.array(clientToolOutputSchema).max(20).default([]),
	...zedTokenSchema.shape,
});

export type ContinueChatInput = z.infer<typeof continueChatInputSchema>;
