import type { ChatId } from "@orcai/core";
import { downloadConversation } from "@/components/ai-elements/conversation";
import { transcriptMarkdown } from "@/lib/ai/turn-view/message-markdown";
import {
	type ChatAgentUIMessage,
	toChatAgentMessages,
} from "@/lib/ai/types/chat-agent-message";
import { client } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const EXPORT_PAGE_SIZE = 100;

const fetchWholeChat = async ({
	chatId,
	zedToken,
}: {
	chatId: ChatId;
	zedToken?: string;
}) => {
	const pages: ChatAgentUIMessage[][] = [];
	let before: number | undefined;
	let hasMore = true;

	while (hasMore) {
		const page = await client.chatMessage.list({
			chatId,
			before,
			limit: EXPORT_PAGE_SIZE,
			zedToken,
		});
		pages.unshift(toChatAgentMessages(page.data));
		before = page.data[0]?.position;
		hasMore = page.hasMore && before !== undefined;
	}

	return pages.flat();
};

/** Downloads the whole chat as a markdown transcript named after its title. */
export const downloadChat = async ({
	chatId,
	zedToken,
}: {
	chatId: ChatId;
	zedToken?: string;
}) => {
	const { data: chat } = await client.chat.find({
		id: chatId,
		zedToken,
	});
	const bot = chat.botId
		? await client.bot
				.find({
					id: chat.botId,
				})
				.catch(() => undefined)
		: undefined;
	const messages = await fetchWholeChat({
		chatId,
		zedToken,
	});
	const title =
		chat.title ??
		(chat.kind === "assistant"
			? m.assistant_conversation_title_placeholder()
			: m.chat_title_placeholder());

	downloadConversation(
		transcriptMarkdown(messages, {
			kind: chat.kind,
			botName: bot?.data.name ?? null,
		}),
		`${title}.md`,
	);
};
