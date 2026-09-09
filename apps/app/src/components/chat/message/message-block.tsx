import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatId } from "@orcai/core";
import type { ReactNode } from "react";
import {
	Message,
	MessageContent,
	MessageToolbar,
} from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { classifyTurn } from "@/components/chat/message/classify-turn";
import { MessageEditor } from "@/components/chat/message/message-editor";
import { WorkLog } from "@/components/chat/message/work-log/work-log";
import { InView } from "@/components/ui/motion/in-view";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { getChatMessageAttachments } from "@/lib/ai/types/chat-attachment";
import { cn } from "@/lib/utils";
import { ChatMessageAttachments } from "./chat-message-attachments";
import { useMessageEditor } from "./hooks/use-message-editor";
import { MessageActions } from "./message-actions";
import { MessagePartRenderer } from "./message-part-renderer";
import { MessageUsage } from "./metadata/message-usage";

interface MessageBlockProps {
	message: ChatAgentUIMessage;
	chatId: ChatId;
	setMessages: UseChatHelpers<ChatAgentUIMessage>["setMessages"];
	regenerate: () => Promise<void>;
	status: UseChatHelpers<ChatAgentUIMessage>["status"];
	/** Only the latest message can still be receiving parts. */
	isLatest: boolean;
	animate?: boolean;
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
	setMessages,
	regenerate,
	status,
	isLatest,
	animate = true,
}: MessageBlockProps) => {
	const { mode, toggleMode, setViewMode } = useMessageEditor();
	const variant = message.role === "user" ? "sent" : "received";
	const messageAttachments = getChatMessageAttachments(message);

	const { entries, answerParts } = classifyTurn(message.parts);
	const running = isLatest && status === "streaming";

	if (
		status === "streaming" &&
		message.role === "assistant" &&
		message.parts.length === 0
	) {
		return (
			<div className="w-full text-foreground">
				<Shimmer>Waiting for the model</Shimmer>
			</div>
		);
	}

	return (
		<MessageEntrance animate={animate}>
			<Message
				from={message.role}
				key={message.id}
				className="grid grid-cols-1"
			>
				{mode === "edit" && variant === "sent" ? (
					<MessageEditor
						message={message}
						setMode={setViewMode}
						setMessages={setMessages}
						regenerate={regenerate}
						status={status}
					/>
				) : (
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
				)}
				<MessageToolbar>
					<MessageActions
						message={message}
						variant={variant}
						chatId={chatId}
						onEdit={variant === "sent" ? toggleMode : undefined}
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
			</Message>
		</MessageEntrance>
	);
};
