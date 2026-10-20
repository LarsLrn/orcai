import {
	displayToolMarkdown,
	displayToolNameOf,
} from "@/components/chat/gen-ui/catalog";
import {
	classifyTurn,
	isToolPart,
	type MessagePart,
} from "@/components/chat/message/classify-turn";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { m } from "@/paraglide/messages";

const answerPartMarkdown = (part: MessagePart): string | undefined => {
	if (part.type === "text") {
		return part.text;
	}

	const name = displayToolNameOf(part.type);
	if (name !== undefined && isToolPart(part)) {
		return displayToolMarkdown(name, part.input) ?? m.gen_ui_cannot_display();
	}

	return undefined;
};

/**
 * Markdown of what the user sees as the message: the answer's text and
 * display parts in order for assistant messages, all text for user messages.
 */
export const messageToMarkdown = (message: ChatAgentUIMessage): string => {
	const blocks =
		message.role === "assistant"
			? classifyTurn(message.parts).answerParts.map(answerPartMarkdown)
			: message.parts.map((part) =>
					part.type === "text" ? part.text : undefined,
				);

	return blocks
		.filter(
			(block): block is string => block !== undefined && block.trim() !== "",
		)
		.join("\n\n");
};

/** One message of a conversation export: the role on its own line, then the content. */
export const messageToTranscriptMarkdown = (
	message: ChatAgentUIMessage,
): string => {
	const roleLabel =
		message.role.charAt(0).toUpperCase() + message.role.slice(1);
	return `**${roleLabel}:**\n\n${messageToMarkdown(message)}`;
};
