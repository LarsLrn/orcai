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
							: "Answers draw on this bot's sources and behaviour."}
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
				<EmptyTitle>Ask anything</EmptyTitle>
				<EmptyDescription>
					Without a bot, answers come from the model alone. Choose a bot to
					ground them in your organisation's sources.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
};

export { ChatPlaceholder };
