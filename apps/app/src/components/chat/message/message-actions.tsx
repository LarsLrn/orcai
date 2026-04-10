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
import type { Chat } from "@/lib/orpc/schemas/chat";
import { cn } from "@/lib/utils";

export const MessageActions = ({
	message,
	variant,
	chatId,
	onEdit,
	className,
}: {
	message: ChatAgentUIMessage;
	variant: "sent" | "received";
	chatId: Chat["id"];
	onEdit?: () => void;
} & MessageActionsProps) => {
	const [, copy] = useCopyToClipboard();

	const handleCopy = () => {
		const textContent =
			message.parts?.find((part) => part.type === "text")?.text ?? "";
		toast.promise(copy(textContent), {
			loading: "Copying to clipboard...",
			success: "Copied to clipboard!",
			error: (error) => ({
				message: "Failed to copy to clipboard",
				description: error.message,
			}),
		});
	};

	if (variant === "sent") {
		return (
			<Actions className={cn("mt-2", className)}>
				{onEdit && (
					<Action label="Edit" tooltip="Edit message" onClick={onEdit}>
						<PencilIcon className="size-3" />
					</Action>
				)}
				<Action label="Copy" tooltip="Copy message" onClick={handleCopy}>
					<CopyIcon className="size-3" />
				</Action>
			</Actions>
		);
	}

	return (
		<Actions className={cn("mt-2", className)}>
			<Action label="Copy" tooltip="Copy response" onClick={handleCopy}>
				<CopyIcon className="size-3" />
			</Action>
			<MessageRate chatId={chatId} messageId={message.id} />
		</Actions>
	);
};
