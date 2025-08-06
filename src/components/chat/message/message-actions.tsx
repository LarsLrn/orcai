import { CopyIcon, PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";
import { MessageRate } from "@/components/chat/message-rate";
import {
	ChatBubbleAction,
	ChatBubbleActionWrapper,
} from "@/components/ui/chat/chat-bubble";
import type { CustomUIMessage } from "@/lib/ai/tools";

interface MessageActionsProps {
	message: CustomUIMessage;
	variant: "sent" | "received";
	chatId: string;
	onEdit?: () => void;
	score?: any;
}

export const MessageActions = ({
	message,
	variant,
	chatId,
	onEdit,
	score,
}: MessageActionsProps) => {
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
			<ChatBubbleActionWrapper variant="sent" className="w-full gap-2 pt-2">
				{onEdit && (
					<ChatBubbleAction
						className="size-6 text-primary"
						actionLabel="Edit"
						icon={<PencilIcon className="size-3" />}
						onClick={onEdit}
					/>
				)}
				<ChatBubbleAction
					className="size-6 text-primary"
					actionLabel="Copy"
					icon={<CopyIcon className="size-3" />}
					onClick={handleCopy}
				/>
			</ChatBubbleActionWrapper>
		);
	}

	return (
		<ChatBubbleActionWrapper variant="received" className="gap-2 pt-2">
			<ChatBubbleAction
				className="size-6"
				actionLabel="Copy"
				icon={<CopyIcon className="size-3" />}
				onClick={handleCopy}
			/>
			<MessageRate
				chatId={chatId}
				messageId={message.id}
				score={score}
				id="ai-message-rate"
			/>
		</ChatBubbleActionWrapper>
	);
};
