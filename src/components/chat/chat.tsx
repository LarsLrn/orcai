import { useChat } from "@ai-sdk/react";
import { eventIteratorToStream } from "@orpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ApiGetScoresResponseData } from "langfuse";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { ChatInput } from "@/components/ui/chat/chat-input";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import type { CustomUIMessage } from "@/lib/ai/tools";
import { client } from "@/lib/orpc/orpc";
import { chatQueryOptions } from "@/lib/query-options/chat";
/* import { deleteTrailingMessages } from "@/db/actions/ai-actions"; */
/* import {
  type DataStreamDelta,
  useStreamingText,
} from "@/hooks/use-streaming-text"; */
import { ChatPlaceholder } from "./chat-placeholder";
import { ChatSettings } from "./chat-settings";
import { MessageBlock } from "./message-block";
import { ShinyText } from "./shiny-text";

const Chat = ({
	id,
	initialMessages,
	scores,
}: {
	id: string;
	initialMessages: CustomUIMessage[];
	scores: ApiGetScoresResponseData[];
}) => {
	const { data: chat } = useSuspenseQuery(
		chatQueryOptions.find({ input: { id } }),
	);

	const { messages, status, setMessages, stop, regenerate, sendMessage } =
		useChat({
			id,
			transport: {
				async sendMessages(options) {
					return eventIteratorToStream(
						await client.ai.chat(
							{
								chatId: options.chatId,
								messages: options.messages,
								botId: chat.data.botId,
							},
							{ signal: options.abortSignal },
						),
					);
				},
				reconnectToStream() {
					throw new Error("Unsupported");
				},
			},

			experimental_throttle: 100,
			generateId: uuidv4,
			messages: initialMessages,
			onFinish: () => {
				/* resetStream(); */
			},
			onError: (error) => {
				toast.error("An error occurred, please try again!", {
					description: error.message,
				});
			},
		});

	/* const { toolStream, reset: resetStream } = useStreamingText(
    dataStream as DataStreamDelta[],
  ); */

	const handleReload = () => {
		/* deleteTrailingMessages({
			chatId: id,
			messageId: messages[messages.length - 1].id,
		}).then(() => {
			reload();
		}); */
	};

	return (
		<div className="flex size-full min-h-0 min-w-0 flex-col gap-4 bg-background">
			<ChatMessageList>
				{messages.map((m) => (
					<MessageBlock
						key={m.id}
						message={m}
						chatId={id}
						/* toolStream={toolStream} */
						setMessages={setMessages}
						regenerate={regenerate}
						status={status}
						score={scores.find((s) => s.id === m.id)}
					/>
				))}
				{messages.length === 0 && <ChatPlaceholder />}
				{status === "submitted" && (
					<div className="sticky m-0 w-full max-w-full whitespace-pre-wrap break-words rounded-none bg-transparent p-4 text-foreground">
						<ShinyText>Gathering information...</ShinyText>
					</div>
				)}
				{status === "error" && (
					<div className="sticky m-0 w-full max-w-full whitespace-pre-wrap break-words rounded-none bg-transparent p-4 text-foreground">
						Something went wrong. Please try again.
					</div>
				)}
			</ChatMessageList>

			<ChatSettings chatId={id} />
			<ChatInput
				hasMessages={messages.length > 0}
				status={status}
				sendMessage={sendMessage}
				handleReload={handleReload}
				setMessages={setMessages}
				chatId={id}
				stop={stop}
				placeholder="How can I help?"
			/>
		</div>
	);
};

export { Chat };
