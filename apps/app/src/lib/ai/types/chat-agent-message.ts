import type { ChatMessageId } from "@orcai/core";
import type { ChatMessageAttachment, ChatMessageMetadata } from "@orcai/schema";
import type { InferAgentUIMessage } from "ai";
import type { createChatAgent } from "@/lib/ai/agents/chat-agent";

export type ChatAgentUIMessage = Omit<
	InferAgentUIMessage<ReturnType<typeof createChatAgent>, ChatMessageMetadata>,
	"id"
> & {
	id: ChatMessageId;
	attachments?: ChatMessageAttachment[];
};
