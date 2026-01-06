import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import type { ApiGetScoresResponseData } from "langfuse";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { MessageEditor } from "@/components/chat/message/message-editor";
import { InView } from "@/components/ui/motion/in-view";
import { TextShimmer } from "@/components/ui/motion/text-shimmer";
import type { CustomUIMessage } from "@/lib/ai/tools";
import type { Chat } from "@/lib/orpc/schemas/chat";
import { useMessageEditor } from "./hooks/use-message-editor";
import { MessageActions } from "./message-actions";
import { MessagePartRenderer } from "./message-part-renderer";
import { MessageModel } from "./metadata/message-model";
import { MessageUsage } from "./metadata/message-usage";

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

	// Sort message parts to place "text" type parts at the end
	const sortedParts = [...message.parts].sort((a, b) => {
		// If a is text and b is not text, a should come after b
		if (a.type === "text" && b.type !== "text") return 1;
		// If b is text and a is not text, b should come after a
		if (b.type === "text" && a.type !== "text") return -1;
		// Otherwise, maintain original order
		return 0;
	});

	if (
		status === "streaming" &&
		message.role === "assistant" &&
		message.parts.length === 0
	) {
		return (
			<div className="wrap-break-word sticky m-0 w-full max-w-full whitespace-pre-wrap rounded-none bg-transparent p-4 text-foreground">
				<TextShimmer>Gathering information...</TextShimmer>
			</div>
		);
	}

	return (
		<InView
			variants={{
				hidden: { opacity: 0, y: 100, filter: "blur(4px)" },
				visible: { opacity: 1, y: 0, filter: "blur(0px)" },
			}}
			viewOptions={{ margin: "0px 0px -200px 0px" }}
			transition={{ duration: 0.3, ease: "easeInOut" }}
		>
			<Message
				from={message.role}
				key={message.id}
				className="grid grid-cols-1"
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
					<MessageContent variant="flat">
						{sortedParts.map((part, i) => (
							<MessagePartRenderer
								key={`${part.type}${message.id}${i}`}
								part={part}
							/>
						))}
					</MessageContent>
				)}
				<div className="flex justify-between">
					<MessageActions
						message={message}
						variant={variant}
						chatId={chatId}
						onEdit={variant === "sent" ? toggleMode : undefined}
						score={score}
					/>
					<div className="mt-1 flex items-center justify-end gap-2">
						<MessageModel message={message} />
						<MessageUsage message={message} />
					</div>
				</div>
			</Message>
		</InView>
	);
};
