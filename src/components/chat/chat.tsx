import { useChat } from "@ai-sdk/react";
import { eventIteratorToStream } from "@orpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ApiGetScoresResponseData } from "langfuse";
import { toast } from "sonner";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { TextShimmer } from "@/components/ui/motion/text-shimmer";
import type { CustomUIMessage } from "@/lib/ai/tools";
import { client } from "@/lib/orpc/orpc";
import { chatQueryOptions } from "@/lib/query-options/chat";
import { ChatInput } from "./chat-input";
import { ChatPlaceholder } from "./chat-placeholder";
import { MessageBlock } from "./message/message-block";

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

	const { messages, status, setMessages, regenerate, sendMessage } = useChat({
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

	return (
		<div className="flex size-full min-h-0 min-w-0 flex-col">
			<Conversation className="flex w-full">
				<ConversationContent className="mx-auto w-full max-w-[800px]">
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
							<TextShimmer>Gathering information...</TextShimmer>
						</div>
					)}
					{status === "error" && (
						<div className="sticky m-0 w-full max-w-full whitespace-pre-wrap break-words rounded-none bg-transparent p-4 text-foreground">
							Something went wrong. Please try again.
						</div>
					)}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>

			<div className="mx-auto flex w-full flex-col gap-2 bg-background px-4 pb-4 md:max-w-3xl md:pb-6">
				<ChatInput
					chatId={id}
					status={status}
					sendMessage={sendMessage}
					chatLength={messages.length}
				/>
			</div>
		</div>
	);
};

export { Chat };
