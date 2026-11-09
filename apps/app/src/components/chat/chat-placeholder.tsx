import type { BotId } from "@orcai/core";
import { useQuery } from "@tanstack/react-query";
import { BotIcon, MessageSquareIcon } from "lucide-react";
import { Placeholder } from "@/components/placeholders/placeholder";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const ChatPlaceholder = ({ botId }: { botId?: BotId }) => {
	const { data: botResult } = useQuery(
		orpc.bot.find.queryOptions({
			input: {
				id: botId ?? "",
			},
			enabled: !!botId,
		}),
	);
	const bot = botResult?.data;

	if (botId && bot) {
		return (
			<Placeholder
				className="h-full"
				Icon={BotIcon}
				title={bot.name}
				description={
					bot.description || m.chat_placeholder_bot_description_fallback()
				}
			/>
		);
	}

	return (
		<Placeholder
			className="h-full"
			Icon={MessageSquareIcon}
			title={m.chat_placeholder_title()}
			description={m.chat_placeholder_description()}
		/>
	);
};

export { ChatPlaceholder };
