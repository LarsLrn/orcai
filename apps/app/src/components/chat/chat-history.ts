import type { ChatId } from "@orcai/core";
import { downloadConversation } from "@/components/ai-elements/conversation";
import { transcriptMarkdown } from "@/lib/ai/turn-view/message-markdown";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { client } from "@/lib/orpc/orpc";

const EXPORT_PAGE_SIZE = 100;

/** Stored parts are untyped; the chat's UI message type is inferred from its tools. */
export const toChatAgentMessages = (
	messages: unknown[],
): ChatAgentUIMessage[] => messages as ChatAgentUIMessage[];

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

/** Downloads the whole chat as a markdown transcript. */
export const downloadChat = async (chat: {
	chatId: ChatId;
	zedToken?: string;
}) => downloadConversation(transcriptMarkdown(await fetchWholeChat(chat)));
