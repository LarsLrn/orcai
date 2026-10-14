import type { BotId } from "@orcai/core";
import { useQuery } from "@tanstack/react-query";
import { BotIcon, MessageSquareIcon } from "lucide-react";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
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
			<Empty className="h-full">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<BotIcon />
					</EmptyMedia>
					<EmptyTitle>{bot.name}</EmptyTitle>
					<EmptyDescription>
						{bot.description
							? bot.description
							: m.chat_placeholder_bot_description_fallback()}
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<Empty className="h-full">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<MessageSquareIcon />
				</EmptyMedia>
				<EmptyTitle>{m.chat_placeholder_title()}</EmptyTitle>
				<EmptyDescription>{m.chat_placeholder_description()}</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
};

export { ChatPlaceholder };
