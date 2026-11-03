import { HistoryIcon, TimerOffIcon, UnplugIcon } from "lucide-react";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { m } from "@/paraglide/messages";

/** Why the reply's model saw less than the whole chat, or why it stopped early. */
const MessageContextNotice = ({ message }: { message: ChatAgentUIMessage }) => {
	const metadata = message.metadata;
	// The first that applies.
	const notice = (
		[
			[
				metadata?.timeLimitReached,
				TimerOffIcon,
				m.chat_message_time_limit_reached,
			],
			[
				metadata?.contextLimitReached,
				HistoryIcon,
				m.chat_message_context_limit_reached,
			],
			[
				metadata?.interrupted,
				UnplugIcon,
				m.chat_message_interrupted,
			],
			[
				metadata?.historyTrimmed,
				HistoryIcon,
				m.chat_message_history_trimmed,
			],
		] as const
	).find(([applies]) => applies);

	if (!notice) {
		return null;
	}
	const [, Icon, text] = notice;

	return (
		<span className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
			<Icon className="size-3.5 shrink-0" />
			{text()}
		</span>
	);
};

export { MessageContextNotice };
