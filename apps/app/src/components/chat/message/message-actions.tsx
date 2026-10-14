import type { ChatId } from "@orcai/core";
import { CopyIcon, PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";
import {
	MessageAction as Action,
	MessageActions as Actions,
	type MessageActionsProps,
} from "@/components/ai-elements/message";
import { MessageRate } from "@/components/chat/message/message-rate";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export const MessageActions = ({
	message,
	variant,
	chatId,
	onEdit,
	className,
}: {
	message: ChatAgentUIMessage;
	variant: "sent" | "received";
	chatId: ChatId;
	onEdit?: () => void;
} & MessageActionsProps) => {
	const [, copy] = useCopyToClipboard();

	const handleCopy = () => {
		const textContent =
			message.parts?.find((part) => part.type === "text")?.text ?? "";
		toast.promise(copy(textContent), {
			loading: m.chat_message_copy_toast_loading(),
			success: m.chat_message_copy_toast_success(),
			error: (error) => ({
				message: m.chat_message_copy_toast_error(),
				description: error.message,
			}),
		});
	};

	if (variant === "sent") {
		return (
			<Actions className={cn("mt-2", className)}>
				{onEdit && (
					<Action
						label={m.common_edit_button()}
						tooltip={m.chat_message_edit_tooltip()}
						onClick={onEdit}
					>
						<PencilIcon className="size-3" />
					</Action>
				)}
				<Action
					label={m.chat_message_copy_label()}
					tooltip={m.chat_message_copy_tooltip()}
					onClick={handleCopy}
				>
					<CopyIcon className="size-3" />
				</Action>
			</Actions>
		);
	}

	return (
		<Actions className={cn("mt-2", className)}>
			<Action
				label={m.chat_message_copy_label()}
				tooltip={m.chat_message_copy_response_tooltip()}
				onClick={handleCopy}
			>
				<CopyIcon className="size-3" />
			</Action>
			<MessageRate chatId={chatId} messageId={message.id} />
		</Actions>
	);
};
