import type { ChatMessageId } from "@orcai/core";
import type { ChatMessageAttachment, ChatMessageMetadata } from "@orcai/schema";
import type { InferAgentUIMessage } from "ai";
import type { createAssistantAgent } from "@/lib/ai/agents/assistant-agent";

export type AssistantAgentUIMessage = Omit<
	InferAgentUIMessage<
		ReturnType<typeof createAssistantAgent>,
		ChatMessageMetadata
	>,
	"id"
> & {
	id: ChatMessageId;
	attachments?: ChatMessageAttachment[];
};
