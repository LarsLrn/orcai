import { CopyIcon, PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";
import { Action, Actions } from "@/components/ai-elements/actions";
import { MessageRate } from "@/components/chat/message/message-rate";
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
			<Actions className="mt-2">
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
		<Actions className="mt-2">
			<Action label="Copy" tooltip="Copy response" onClick={handleCopy}>
				<CopyIcon className="size-3" />
			</Action>
			<MessageRate chatId={chatId} messageId={message.id} score={score} />
		</Actions>
	);
};
