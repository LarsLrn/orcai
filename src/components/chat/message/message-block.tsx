import type { UseChatHelpers } from "@ai-sdk/react";
import type { ApiGetScoresResponseData } from "langfuse";
import {
	Message,
	MessageContent,
	MessageToolbar,
} from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { MessageEditor } from "@/components/chat/message/message-editor";
import { InView } from "@/components/ui/motion/in-view";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { getChatMessageAttachments } from "@/lib/ai/types/chat-attachment";
import type { Chat } from "@/lib/orpc/schemas/chat";
import { cn } from "@/lib/utils";
import { ChatMessageAttachments } from "./chat-message-attachments";
import { useMessageEditor } from "./hooks/use-message-editor";
import { MessageActions } from "./message-actions";
import { MessagePartRenderer } from "./message-part-renderer";
import { MessageUsage } from "./metadata/message-usage";

interface MessageBlockProps {
	message: ChatAgentUIMessage;
	chatId: Chat["id"];
	setMessages: UseChatHelpers<ChatAgentUIMessage>["setMessages"];
	regenerate: () => Promise<void>;
	status: UseChatHelpers<ChatAgentUIMessage>["status"];
	score?: ApiGetScoresResponseData;
}

export const MessageBlock = ({
	message,
	chatId,
	setMessages,
	regenerate,
	status,
	score,
}: MessageBlockProps) => {
	const { mode, toggleMode, setViewMode } = useMessageEditor();
	const variant = message.role === "user" ? "sent" : "received";
	const messageAttachments = getChatMessageAttachments(message);

	// Filter and sort message parts:
	// keep only the last text part; keep all non-text parts
	// Some models tend to generate text WITH their tool calls, which this filters out
	const sortedParts = (() => {
		const parts = [
			...message.parts,
		];

		let lastTextIndex = -1;
		for (let i = parts.length - 1; i >= 0; i--) {
			if (parts[i].type === "text") {
				lastTextIndex = i;
				break;
			}
		}

		const filteredParts = parts.filter((part, index) => {
			if (part.type !== "text") return true;
			return index === lastTextIndex;
		});

		return filteredParts.sort((a, b) => {
			if (a.type === "text" && b.type !== "text") return 1;
			if (b.type === "text" && a.type !== "text") return -1;
			return 0;
		});
	})();

	if (
		status === "streaming" &&
		message.role === "assistant" &&
		message.parts.length === 0
	) {
		return (
			<div className="wrap-break-word sticky m-0 w-full max-w-full whitespace-pre-wrap rounded-none bg-transparent p-4 text-foreground">
				<Shimmer>Gathering information...</Shimmer>
			</div>
		);
	}

	return (
		<InView
			variants={{
				hidden: {
					opacity: 0,
					y: 100,
					filter: "blur(4px)",
				},
				visible: {
					opacity: 1,
					y: 0,
					filter: "blur(0px)",
				},
			}}
			viewOptions={{
				margin: "0px 0px -200px 0px",
			}}
			transition={{
				duration: 0.3,
				ease: "easeInOut",
			}}
		>
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
						{sortedParts.map((part, i) => (
							<MessagePartRenderer
								key={`${part.type}${message.id}${
									// biome-ignore lint/suspicious/noArrayIndexKey: Need stable key and parts don't have ids
									i
								}`}
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
						score={score}
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
		</InView>
	);
};
