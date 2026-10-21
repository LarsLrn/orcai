import { displayToolMarkdown } from "@/components/chat/gen-ui/catalog";
import { formatAssetTitle } from "@/components/chat/message/asset-title";
import { type Citations, messageCitations } from "@/lib/ai/tools/rag/citations";
import { toolNameOf } from "@/lib/ai/tools/registry";
import type { AnswerPart, MessageView } from "@/lib/ai/turn-view/turn-view";
import { m } from "@/paraglide/messages";

const CITE = /<cite\b([^>]*)>([\s\S]*?)<\/cite>/g;
const ATTRIBUTE = /([\w-]+)\s*=\s*"([^"]*)"/g;

const unescapeAttribute = (value: string) =>
	value.replaceAll("&quot;", '"').replaceAll("&amp;", "&");

/** The source a cite tag names by chunk ref, or by title and page in older answers. */
const citeSource = (
	attributes: string,
	citations: Citations,
):
	| {
			title: string;
			page?: number;
	  }
	| undefined => {
	const values = new Map(
		Array.from(attributes.matchAll(ATTRIBUTE), ([, name, value]) => [
			name,
			unescapeAttribute(value),
		]),
	);
	const chunk = values.get("chunk");

	if (chunk !== undefined) {
		return Object.hasOwn(citations, chunk) ? citations[chunk] : undefined;
	}

	const page = Number.parseInt(
		values.get("page") ??
			values.get("pageNumber") ??
			values.get("page_number") ??
			"",
		10,
	);

	return {
		title: values.get("title") ?? "",
		...(Number.isInteger(page) &&
			page > 0 && {
				page,
			}),
	};
};

/** Cite tags as `cited text (Title, p. N)`; a ref without a source leaves the cited text. */
const citationsAsText = (text: string, citations: Citations) =>
	text.replace(CITE, (_, attributes: string, cited: string) => {
		const source = citeSource(attributes, citations);

		if (!source) {
			return cited;
		}

		const title =
			formatAssetTitle(source.title) ?? m.chat_source_fallback_title();

		return `${cited} (${
			source.page === undefined
				? title
				: m.chat_message_copy_citation_with_page({
						title,
						page: source.page,
					})
		})`;
	});

const answerPartMarkdown = (
	answer: AnswerPart,
	citations: Citations,
): string | undefined => {
	switch (answer.kind) {
		case "text":
			return citationsAsText(answer.part.text, citations);
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
	const citations = messageCitations(message);
	const blocks =
		message.role === "assistant"
			? answer.map((part) => answerPartMarkdown(part, citations))
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
