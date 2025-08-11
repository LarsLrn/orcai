import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import type { ApiGetScoresResponseData } from "langfuse";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { MessageEditor } from "@/components/chat/message-editor";
import type { CustomUIMessage } from "@/lib/ai/tools";
import type { Chat } from "@/lib/orpc/schemas/chat";
import { useMessageEditor } from "./hooks/use-message-editor";
import { MessageActions } from "./message-actions";
import { MessagePartRenderer } from "./message-part-renderer";

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

	return (
		<Message from={message.role} key={message.id}>
			<div className="flex flex-col">
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
					<MessageContent>
						{message.parts.map((part, i) => (
							<MessagePartRenderer
								key={`${part.type}${message.id}${i}`}
								part={part}
							/>
						))}
					</MessageContent>
				)}
				<MessageActions
					message={message}
					variant={variant}
					chatId={chatId}
					onEdit={variant === "sent" ? toggleMode : undefined}
					score={score}
				/>
			</div>
		</Message>
	);
};
