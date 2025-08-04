import { useChat } from "@ai-sdk/react";
import { eventIteratorToStream } from "@orpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ApiGetScoresResponseData } from "langfuse";
import { toast } from "sonner";
import { ChatInput } from "@/components/ui/chat/chat-input";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import type { CustomUIMessage } from "@/lib/ai/tools";
import { client } from "@/lib/orpc/orpc";
import { chatQueryOptions } from "@/lib/query-options/chat";
import { ChatUtilities } from "../ui/chat/chat-input-actions";
/* import { deleteTrailingMessages } from "@/db/actions/ai-actions"; */
import { ChatPlaceholder } from "./chat-placeholder";
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
			messages: initialMessages,
			onError: (error) => {
				toast.error("An error occurred, please try again!", {
					description: error.message,
				});
			},
		});

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

			<div className="mx-auto flex w-full flex-col gap-2 bg-background px-4 pb-4 md:max-w-3xl md:pb-6">
				<ChatInput
					status={status}
					sendMessage={sendMessage}
					handleReload={handleReload}
					setMessages={setMessages}
					chatId={id}
					stop={stop}
					placeholder="How can I help?"
				/>
				<div className="flex items-center gap-2">
					<ChatUtilities
						chatId={id}
						hasMessages={messages.length > 0}
						handleReload={handleReload}
					/>
				</div>
			</div>
		</div>
	);
};

export { Chat };
