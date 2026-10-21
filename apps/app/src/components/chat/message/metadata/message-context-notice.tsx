import { HistoryIcon } from "lucide-react";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { m } from "@/paraglide/messages";

/** Why the reply's model saw less than the whole chat, or stopped early for room. */
const MessageContextNotice = ({ message }: { message: ChatAgentUIMessage }) => {
	const notice = message.metadata?.contextLimitReached
		? m.chat_message_context_limit_reached()
		: message.metadata?.historyTrimmed
			? m.chat_message_history_trimmed()
			: undefined;

	return notice ? (
		<span className="flex min-w-0 items-center gap-1 text-muted-foreground text-xs">
			<HistoryIcon className="size-3.5 shrink-0" />
			{notice}
		</span>
	) : null;
};

export { MessageContextNotice };
