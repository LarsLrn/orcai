import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatId } from "@orcai/core";
import type { ChatBranchLink } from "@orcai/schema";
import type { ReactNode } from "react";
import {
	Message,
	MessageContent,
	MessageToolbar,
} from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { MessageBranches } from "@/components/chat/branch-links";
import { classifyTurn } from "@/components/chat/message/classify-turn";
import { WorkLog } from "@/components/chat/message/work-log/work-log";
import { InView } from "@/components/ui/motion/in-view";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { getChatMessageAttachments } from "@/lib/ai/types/chat-attachment";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { ChatMessageAttachments } from "./chat-message-attachments";
import { MessageActions } from "./message-actions";
import { MessagePartRenderer } from "./message-part-renderer";
import { MessageUsage } from "./metadata/message-usage";

interface MessageBlockProps {
	message: ChatAgentUIMessage;
	chatId: ChatId;
	status: UseChatHelpers<ChatAgentUIMessage>["status"];
	/** Only the latest message can still be receiving parts. */
	isLatest: boolean;
	animate?: boolean;
	/** Chats branched from this message. */
	branches?: ChatBranchLink[];
	onBranch?: () => void;
	branching?: boolean;
}

const MessageEntrance = ({
	animate,
	children,
}: {
	animate: boolean;
	children: ReactNode;
}) => {
	if (!animate) {
		return <>{children}</>;
	}

	return (
		<InView
			variants={{
				hidden: {
					opacity: 0,
					y: 8,
				},
				visible: {
					opacity: 1,
					y: 0,
				},
			}}
			viewOptions={{
				margin: "0px 0px -200px 0px",
			}}
			transition={{
				duration: 0.2,
				ease: "easeOut",
			}}
		>
			{children}
		</InView>
	);
};

export const MessageBlock = ({
	message,
	chatId,
	status,
	isLatest,
	animate = true,
	branches = [],
	onBranch,
	branching,
}: MessageBlockProps) => {
	const variant = message.role === "user" ? "sent" : "received";
	const messageAttachments = getChatMessageAttachments(message);

	const { entries, answerParts } = classifyTurn(message.parts);
	const running = isLatest && status === "streaming";

	// A reply exists from the first chunk on, before the model has written anything.
	if (message.role === "assistant" && message.parts.length === 0) {
		return running ? (
			<div className="w-full text-foreground">
				<Shimmer>{m.chat_waiting_for_model()}</Shimmer>
			</div>
		) : null;
	}

	return (
		<MessageEntrance animate={animate}>
			<Message
				from={message.role}
				key={message.id}
				className="grid grid-cols-1"
			>
				<MessageContent>
					<ChatMessageAttachments attachments={messageAttachments} />
					{entries.length > 0 && (
						<WorkLog entries={entries} running={running} />
					)}
					{answerParts.map((part, i) => (
						<MessagePartRenderer
							key={`${part.type}${message.id}${i}`}
							part={part}
						/>
					))}
				</MessageContent>
				<MessageToolbar>
					<MessageActions
						message={message}
						variant={variant}
						chatId={chatId}
						onBranch={onBranch}
						branching={branching}
						className={cn({
							"w-full justify-end": variant === "sent",
						})}
					/>
					{variant === "received" && (
						<div className="mt-1 flex items-center justify-end gap-2">
							<MessageUsage message={message} />
						</div>
					)}
				</MessageToolbar>
				{branches.length > 0 && (
					<MessageBranches
						branches={branches}
						className={cn({
							"justify-end": variant === "sent",
						})}
					/>
				)}
			</Message>
		</MessageEntrance>
	);
};
