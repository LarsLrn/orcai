import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import type { ApiGetScoresResponseData } from "langfuse";
import { AnimatePresence, motion } from "motion/react";
import { MessageEditor } from "@/components/chat/message-editor";
import {
	ChatBubble,
	ChatBubbleMessage,
} from "@/components/ui/chat/chat-bubble";
import type { CustomUIMessage } from "@/lib/ai/tools";
import type { Chat } from "@/lib/orpc/schemas/chat";
import { cn } from "@/lib/utils";
import { useMessageEditor } from "./hooks/use-message-editor";
import { MessageActions } from "./message-actions";
import { MessageContent } from "./message-content";

interface MessageBlockProps {
	message: CustomUIMessage;
	chatId: Chat["id"];
	setMessages: UseChatHelpers<CustomUIMessage>["setMessages"];
	regenerate: () => Promise<void>;
	status: UseChatHelpers<UIMessage>["status"];
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
	const isLoading = message.parts?.length === 0 && status === "streaming";

	return (
		<ChatBubble
			variant={variant}
			className={cn("items-start", {
				"max-w-full": variant === "received",
			})}
		>
			<AnimatePresence>
				<motion.div
					initial={{ y: 5, opacity: 0 }}
					whileInView={{ y: 0, opacity: 1 }}
					transition={{ duration: 0.5, ease: "easeIn" }}
					data-role={message.role}
				>
					<ChatBubbleMessage
						isLoading={isLoading}
						variant={variant}
						className={cn(
							{
								"w-[calc(100dvw-31px)] rounded-none bg-transparent md:w-[calc(100dvw-316px)] lg:max-w-[800px]":
									variant === "received",
							},
							"sticky",
						)}
					>
						{mode === "edit" && variant === "sent" ? (
							<MessageEditor
								chatId={chatId}
								message={message}
								setMode={setViewMode}
								setMessages={setMessages}
								regenerate={regenerate}
								status={status}
							/>
						) : (
							<MessageContent message={message} variant={variant} />
						)}

						<MessageActions
							message={message}
							variant={variant}
							chatId={chatId}
							onEdit={variant === "sent" ? toggleMode : undefined}
							score={score}
						/>
					</ChatBubbleMessage>
				</motion.div>
			</AnimatePresence>
		</ChatBubble>
	);
};
