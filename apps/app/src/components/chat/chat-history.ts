import type { ChatId } from "@orcai/core";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { client } from "@/lib/orpc/orpc";

const EXPORT_PAGE_SIZE = 100;

// Unfortunately required for now to restore types after route validation, since UI Messages are dynamically inferred based on available tools, metadata and more, which makes it impossible to statically define the shape in the @orcai/schema package.
export const toChatAgentMessages = (
	messages: unknown[],
): ChatAgentUIMessage[] => messages as ChatAgentUIMessage[];

export const fetchWholeChat = async ({
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
