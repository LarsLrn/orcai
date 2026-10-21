import { displayToolMarkdown } from "@/components/chat/gen-ui/catalog";
import { toolNameOf } from "@/lib/ai/tools/registry";
import type { AnswerPart, MessageView } from "@/lib/ai/turn-view/turn-view";
import { m } from "@/paraglide/messages";

const answerPartMarkdown = (answer: AnswerPart): string | undefined => {
	switch (answer.kind) {
		case "text":
			return answer.part.text;
		case "display":
			return (
				displayToolMarkdown(toolNameOf(answer.part), answer.part.input) ??
				m.gen_ui_cannot_display()
			);
		default:
			return undefined;
	}
};

/**
 * Markdown of what the user sees as the message: the answer's text and
 * display parts in order for assistant messages, all text for user messages.
 */
export const messageToMarkdown = ({ message, answer }: MessageView): string => {
	const blocks =
		message.role === "assistant"
			? answer.map(answerPartMarkdown)
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
export const messageToTranscriptMarkdown = (view: MessageView): string => {
	const { role } = view.message;
	const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
	return `**${roleLabel}:**\n\n${messageToMarkdown(view)}`;
};
