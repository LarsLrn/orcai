import type { ChatMessageId } from "@orcai/core";
import type { ChatMessageAttachment, ChatMessageMetadata } from "@orcai/schema";
import type { InferUITools, UIMessage } from "ai";
import type { createAssistantAgent } from "@/lib/ai/agents/assistant-agent";
import type { createChatAgent } from "@/lib/ai/agents/chat-agent";

/** The tools of both chat kinds, so one message type covers plain, bot and assistant chats. */
type ChatAgentTools = ReturnType<typeof createChatAgent>["tools"] &
	ReturnType<typeof createAssistantAgent>["tools"];

export type ChatAgentUIMessage = Omit<
	UIMessage<ChatMessageMetadata, never, InferUITools<ChatAgentTools>>,
	"id"
> & {
	id: ChatMessageId;
	attachments?: ChatMessageAttachment[];
};
