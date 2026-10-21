import type { ChatId } from "@orcai/core";
import { CopyIcon, GitBranchIcon } from "lucide-react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";
import {
	MessageAction as Action,
	MessageActions as Actions,
	type MessageActionsProps,
} from "@/components/ai-elements/message";
import { MessageRate } from "@/components/chat/message/message-rate";
import { messageToMarkdown } from "@/lib/ai/turn-view/message-markdown";
import type { MessageView } from "@/lib/ai/turn-view/turn-view";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export const MessageActions = ({
	view,
	variant,
	chatId,
	onBranch,
	branching = false,
	className,
}: {
	view: MessageView;
	variant: "sent" | "received";
	chatId: ChatId;
	/** Left out while the message can't be branched from yet. */
	onBranch?: () => void;
	branching?: boolean;
} & MessageActionsProps) => {
	const [, copy] = useCopyToClipboard();

	const handleCopy = () => {
		toast.promise(copy(messageToMarkdown(view)), {
			loading: m.chat_message_copy_toast_loading(),
			success: m.chat_message_copy_toast_success(),
			error: (error) => ({
				message: m.chat_message_copy_toast_error(),
				description: reasonMessageOf(error),
			}),
		});
	};

	const branchAction = onBranch && (
		<Action
			label={m.chat_message_branch_action()}
			tooltip={m.chat_message_branch_action()}
			loading={branching}
			onClick={onBranch}
		>
			<GitBranchIcon className="size-3" />
		</Action>
	);

	if (variant === "sent") {
		return (
			<Actions className={cn("mt-2", className)}>
				<Action
					label={m.chat_message_copy_label()}
					tooltip={m.chat_message_copy_tooltip()}
					onClick={handleCopy}
				>
					<CopyIcon className="size-3" />
				</Action>
				{branchAction}
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
			{branchAction}
			<MessageRate chatId={chatId} messageId={view.message.id} />
		</Actions>
	);
};
