import type { ChatMessageId } from "@orcai/core";
import type {
	ChatMessageAttachment,
	ChatMessageMetadata,
	ChatMessagePart,
} from "@orcai/schema";
import type { InferUITools, UIMessage } from "ai";
import type { AssistantTools } from "@/lib/ai/agents/assistant-agent";
import type { ChatTools } from "@/lib/ai/agents/chat-agent";

/** The tools of both chat kinds, so one message type covers plain, bot and assistant chats. */
export type ChatAgentTools = ChatTools & AssistantTools;

export type ChatAgentUIMessage = Omit<
	UIMessage<ChatMessageMetadata, never, InferUITools<ChatAgentTools>>,
	"id"
> & {
	id: ChatMessageId;
	attachments?: ChatMessageAttachment[];
};

/**
 * Read parts as the chat's UI parts. A part that passed its schema is the
 * SDK's part; its tool input and output take the chat's tool types, which the
 * SDK checks against the tools at each turn.
 */
export const toChatAgentParts = (parts: readonly ChatMessagePart[]) =>
	parts as ChatAgentUIMessage["parts"];

/** Messages with read parts, as the chat's UI messages. */
export const toChatAgentMessages = (
	messages: readonly {
		id: ChatMessageId;
		role: string;
		parts: readonly ChatMessagePart[];
		metadata: ChatMessageMetadata;
		attachments?: ChatMessageAttachment[];
	}[],
): ChatAgentUIMessage[] =>
	messages.map(
		({ id, role, parts, metadata, attachments }) =>
			({
				id,
				role,
				parts: toChatAgentParts(parts),
				metadata,
				attachments,
			}) as ChatAgentUIMessage,
	);
