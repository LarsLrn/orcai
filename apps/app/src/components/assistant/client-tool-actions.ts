import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";

/** What the latest message's client calls answer with. */
export interface ClientToolActions {
	addToolOutput: UseChatHelpers<ChatAgentUIMessage>["addToolOutput"];
	/** Keeps the zedToken a widget's write returned, so the continuation reads at it. */
	keepZedToken: (zedToken: string | undefined) => void;
}
