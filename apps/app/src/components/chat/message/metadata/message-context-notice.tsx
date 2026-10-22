import { HistoryIcon, TimerOffIcon } from "lucide-react";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { m } from "@/paraglide/messages";

/** Why the reply's model saw less than the whole chat, or why it stopped early. */
const MessageContextNotice = ({ message }: { message: ChatAgentUIMessage }) => {
	const metadata = message.metadata;
	const notice = metadata?.timeLimitReached
		? m.chat_message_time_limit_reached()
		: metadata?.contextLimitReached
			? m.chat_message_context_limit_reached()
			: metadata?.historyTrimmed
				? m.chat_message_history_trimmed()
				: undefined;
	const Icon = metadata?.timeLimitReached ? TimerOffIcon : HistoryIcon;

	return notice ? (
		<span className="flex min-w-0 items-center gap-1 text-muted-foreground text-xs">
			<Icon className="size-3.5 shrink-0" />
			{notice}
		</span>
	) : null;
};

export { MessageContextNotice };
