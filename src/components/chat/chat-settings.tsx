import { skipToken, useQuery } from "@tanstack/react-query";
import type { Chat } from "@/db/schema/chat";
import { orpc } from "@/lib/orpc/orpc";

const ChatSettings = ({ chatId }: { chatId: Chat["id"] }) => {
	const { data: chat } = useQuery(
		orpc.chat.find.queryOptions({
			input: { id: chatId },
			queryKey: orpc.chat.find.key({ input: { id: chatId } }),
		}),
	);

	const { data: bot } = useQuery(
		orpc.bot.find.queryOptions({
			input: chat?.data.botId ? { id: chat.data.botId } : skipToken,
			queryKey: orpc.bot.find.key({
				input: { id: chat?.data.botId ?? undefined },
			}),
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
