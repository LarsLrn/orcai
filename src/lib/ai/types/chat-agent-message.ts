import type { InferAgentUIMessage } from "ai";
import { z } from "zod/v4";
import type { chatAgent } from "@/lib/ai/agents/chat-agent";
import {
	type ChatAttachment,
	chatAttachmentsSchema,
} from "@/lib/ai/types/chat-attachment";
import type { ChatMessage } from "@/lib/orpc/schemas/chat-message";

const metadataSchema = z.object({
	model: z.string().optional(),
	totalUsage: z
		.object({
			cachedInputTokens: z.number().optional(),
			inputTokens: z.number().optional(),
			outputTokens: z.number().optional(),
			reasoningTokens: z.number().optional(),
			totalTokens: z.number().optional(),
		})
		.optional(),
	siblingCount: z.number().optional(),
	siblingIndex: z.number().optional(),
	siblingIds: z.array(z.string()).optional(),
	attachments: chatAttachmentsSchema.optional(),
});

export type ChatAgentMessageMetadata = z.infer<typeof metadataSchema>;

export type ChatAgentUIMessage = Omit<
	InferAgentUIMessage<typeof chatAgent, ChatAgentMessageMetadata>,
	"id"
> & {
	id: ChatMessage["id"];
	attachments?: ChatAttachment[];
};
