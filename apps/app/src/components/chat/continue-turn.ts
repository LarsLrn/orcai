import type { UseChatHelpers } from "@ai-sdk/react";
import {
	lastAssistantMessageIsCompleteWithApprovalResponses,
	lastAssistantMessageIsCompleteWithToolCalls,
	type UIMessage,
} from "ai";
import { isClientToolPart } from "@/lib/ai/tools/assistant/client-tools";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";

/** What the latest message's client calls answer with. */
export interface ClientToolActions {
	addToolOutput: UseChatHelpers<ChatAgentUIMessage>["addToolOutput"];
	/** Keeps the zedToken a widget's write returned, so the continuation reads at it. */
	keepZedToken: (zedToken: string | undefined) => void;
}

/** The last message is a reply whose last step holds a client tool's call. */
export const lastStepHasClientToolPart = ({
	messages,
}: {
	messages: UIMessage[];
}) => {
	const message = messages.at(-1);

	if (message?.role !== "assistant") {
		return false;
	}

	const start = message.parts.reduce(
		(last, part, index) => (part.type === "step-start" ? index : last),
		-1,
	);

	return message.parts.slice(start + 1).some(isClientToolPart);
};

/**
 * Continues a turn once its last step is answered. The bare tool-calls check
 * also holds for a turn that ended on a finished server step, as at the step
 * limit, so it needs a client call in that step.
 */
export const shouldContinueTurn = (options: { messages: UIMessage[] }) =>
	lastAssistantMessageIsCompleteWithApprovalResponses(options) ||
	(lastAssistantMessageIsCompleteWithToolCalls(options) &&
		lastStepHasClientToolPart(options));
