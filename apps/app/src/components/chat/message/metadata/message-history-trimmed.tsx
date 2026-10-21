import { HistoryIcon } from "lucide-react";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { m } from "@/paraglide/messages";

const MessageHistoryTrimmed = ({ message }: { message: ChatAgentUIMessage }) =>
	message.metadata?.historyTrimmed ? (
		<span className="flex min-w-0 items-center gap-1 text-muted-foreground text-xs">
			<HistoryIcon className="size-3.5 shrink-0" />
			{m.chat_message_history_trimmed()}
		</span>
	) : null;

export { MessageHistoryTrimmed };
