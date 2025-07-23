import { skipToken, useQuery } from "@tanstack/react-query";
import type { Chat } from "@/db/schema/chat";
import { botQueryOptions } from "@/lib/query-options/bot";
import { chatQueryOptions } from "@/lib/query-options/chat";

const ChatSettings = ({ chatId }: { chatId: Chat["id"] }) => {
	const { data: chat } = useQuery(
		chatQueryOptions.find({ input: { id: chatId } }),
	);

	const { data: bot } = useQuery(
		botQueryOptions.find({
			input: chat?.data.botId ? { id: chat.data.botId } : skipToken,
		}),
	);

	return (
		<div className="p-4">
			<h2 className="font-semibold text-lg">Chat Settings</h2>
			<p className="mt-2 text-gray-600 text-sm">Uses bot: {bot?.data.name}</p>
		</div>
	);
};

export { ChatSettings };
