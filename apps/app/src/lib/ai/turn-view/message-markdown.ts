import { docsPageUrl } from "@orcai/core";
import type { ChatKind, ChatMessageCitation } from "@orcai/schema";
import type { StreamedCitations } from "@/lib/ai/citations/chat-sources";
import { replaceCiteTags } from "@/lib/ai/citations/cite-tag";
import { toolCallMarkdown } from "@/lib/ai/tools/registry";
import {
	type AnswerPart,
	type MessageView,
	turnView,
} from "@/lib/ai/turn-view/turn-view";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { formatAssetTitle } from "@/lib/assets/asset-title";
import { m } from "@/paraglide/messages";

/** How a cited source reads in copied text; a docs page names its URL only with the docs URL known. */
const sourceText = (
	citation: ChatMessageCitation,
	docsUrl: string | undefined,
) => {
	switch (citation.kind) {
		case "asset": {
			const title =
				formatAssetTitle(citation.title) ?? m.chat_source_fallback_title();

			return citation.page === undefined
				? title
				: m.chat_message_copy_citation_with_page({
						title,
						page: citation.page,
					});
		}
		case "docs": {
			const url = docsUrl && docsPageUrl(docsUrl, citation.path);

			return url ? `${citation.title}, ${url}` : citation.title;
		}
		case "web":
			return `${citation.title}, ${citation.url}`;
	}
};

/** Cite tags as `cited text (Source)`; a ref without a source leaves the cited text. */
const citationsAsText = (
	text: string,
	citations: StreamedCitations,
	docsUrl: string | undefined,
) =>
	replaceCiteTags(text, ({ ref, text: cited }) => {
		const citation =
			ref !== undefined && Object.hasOwn(citations, ref)
				? citations[ref]
				: null;

		return citation ? `${cited} (${sourceText(citation, docsUrl)})` : cited;
	});

const answerPartMarkdown = (
	answer: AnswerPart,
	citations: StreamedCitations,
	docsUrl: string | undefined,
): string | undefined => {
	switch (answer.kind) {
		case "text":
			return citationsAsText(answer.part.text, citations, docsUrl);
		case "display": {
			const markdown = toolCallMarkdown(answer.part);

			return markdown === undefined
				? m.gen_ui_cannot_display()
				: citationsAsText(markdown, citations, docsUrl);
		}
		case "client":
			return toolCallMarkdown(answer.part);
		default:
			return undefined;
	}
};

/**
 * Markdown of what the user sees as the message: the answer's text, display
 * parts and questions in order for assistant messages, all text for user
 * messages.
 */
export const messageToMarkdown = (
	{ message, answer }: MessageView,
	{
		docsUrl,
	}: {
		docsUrl?: string;
	} = {},
): string => {
	const citations = message.metadata?.citations ?? {};
	const blocks =
		message.role === "assistant"
			? answer.map((part) => answerPartMarkdown(part, citations, docsUrl))
			: message.parts.map((part) =>
					part.type === "text" ? part.text : undefined,
				);

	return blocks
		.filter(
			(block): block is string => block !== undefined && block.trim() !== "",
		)
		.join("\n\n");
};

/** What a transcript names the replies after: the Assistant, or the chat's bot. */
export type TranscriptChat = {
	kind: ChatKind;
	botName: string | null;
};

/** The name above a reply: the Assistant's or the bot's, else the model that wrote it. */
const speakerLabel = (view: MessageView, chat: TranscriptChat | undefined) => {
	if (view.message.role === "user") {
		return m.chat_transcript_user();
	}

	return (
		(chat?.kind === "assistant" ? m.assistant_name() : chat?.botName) ??
		view.message.metadata?.model ??
		m.chat_transcript_model()
	);
};

/** The files a question carries, by name. */
const attachmentsLine = ({ message }: MessageView) => {
	const titles =
		message.role === "user"
			? (message.attachments ?? []).map(({ title }) => title)
			: [];

	return titles.length === 0
		? undefined
		: m.chat_transcript_attachments({
				titles: titles.join(", "),
			});
};

/** One message of a conversation export: the speaker on its own line, then its files and content. */
export const messageToTranscriptMarkdown = (
	view: MessageView,
	chat?: TranscriptChat,
): string =>
	`**${speakerLabel(view, chat)}:**\n\n${[
		attachmentsLine(view),
		messageToMarkdown(view),
	]
		.filter((block) => block !== undefined && block !== "")
		.join("\n\n")}`;

/** A stored conversation as markdown, one transcript block per shown message. */
export const transcriptMarkdown = (
	messages: ChatAgentUIMessage[],
	chat?: TranscriptChat,
): string =>
	turnView(messages, "idle")
		.messages.map((view) => messageToTranscriptMarkdown(view, chat))
		.join("\n\n");
