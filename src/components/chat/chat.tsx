import { useChat } from "@ai-sdk/react";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import {
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type { ApiGetScoresResponseData } from "langfuse";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Badge } from "@/components/ui/badge";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { client, orpc } from "@/lib/orpc/orpc";
import type { Chat as ChatType } from "@/lib/orpc/schemas/chat";
import type { ChatBranch } from "@/lib/orpc/schemas/chat-branch";
import { BranchSwitcher } from "./branch-switcher";
import { ChatInput } from "./chat-input";
import { ChatPlaceholder } from "./chat-placeholder";
import { MessageBlock } from "./message/message-block";

const Chat = ({
	id,
	initialMessages,
	scores,
	branchId,
	zedToken,
	pendingMessage,
}: {
	id: ChatType["id"];
	initialMessages: ChatAgentUIMessage[];
	scores: ApiGetScoresResponseData[];
	branchId?: ChatBranch["id"];
	zedToken?: string;
	pendingMessage?: string;
}) => {
	const queryClient = useQueryClient();
	const hasSentPendingMessage = useRef(false);

	const { data: chat } = useSuspenseQuery(
		orpc.chat.find.queryOptions({
			input: {
				id,
				zedToken,
			},
		}),
	);

	const quotaBadge = useQuery(
		orpc.quota.chatBadge.queryOptions({
			input: {
				chatId: id,
			},
		}),
	);

	const { messages, status, setMessages, regenerate, sendMessage } =
		useChat<ChatAgentUIMessage>({
			id,
			transport: {
				async sendMessages(options) {
					return eventIteratorToUnproxiedDataStream(
						await client.ai.chat(
							{
								chatId: options.chatId as ChatType["id"],
								messages: options.messages,
								branchId,
								zedToken,
							},
							{
								signal: options.abortSignal,
							},
						),
					);
				},
				reconnectToStream() {
					throw new Error("Unsupported");
				},
			},
			messages: initialMessages,
			onFinish: async () => {
				// Invalidate chat data to fetch updated activeBranchId and branches
				await queryClient.invalidateQueries({
					queryKey: orpc.chat.key(),
					refetchType: "active",
				});
				await queryClient.invalidateQueries({
					queryKey: orpc.chatMessage.key({
						input: {
							chatId: id,
							zedToken,
						},
					}),
					refetchType: "active",
				});
			},
			onError: (error) => {
				toast.error("An error occurred, please try again!", {
					description: error.message,
				});
			},
		});

	useEffect(() => {
		if (!pendingMessage || hasSentPendingMessage.current) {
			return;
		}
		if (messages.length > 0 || status !== "ready") {
			return;
		}

		hasSentPendingMessage.current = true;
		sendMessage({
			text: pendingMessage,
		}).catch((error) => {
			hasSentPendingMessage.current = false;
			toast.error("Failed to send message", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		});
	}, [
		messages.length,
		pendingMessage,
		sendMessage,
		status,
	]);

	return (
		<div className="flex size-full min-h-0 min-w-0 flex-col">
			<div className="absolute top-2 right-4 z-10 flex items-center gap-2">
				{quotaBadge.data?.data.poolId && (
					<Badge variant="outline" className="bg-background/90">
						{quotaBadge.data.data.poolName}:{" "}
						{quotaBadge.data.data.remainingAmount}{" "}
						{quotaBadge.data.data.meteringMode === "requests"
							? "requests"
							: "tokens"}
					</Badge>
				)}
				<BranchSwitcher chat={chat.data} branches={chat.data.branches} />
			</div>

			<Conversation className="flex w-full" initial="instant">
				<ConversationContent className="mx-auto w-full max-w-200">
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
						<div className="wrap-break-word sticky m-0 w-full max-w-full whitespace-pre-wrap rounded-none bg-transparent p-4 text-foreground">
							<Shimmer>Gathering information...</Shimmer>
						</div>
					)}
					{status === "error" && (
						<div className="wrap-break-word sticky m-0 w-full max-w-full whitespace-pre-wrap rounded-none bg-transparent p-4 text-foreground">
							Something went wrong. Please try again.
						</div>
					)}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>

			<div className="mx-auto flex w-full flex-col gap-2 px-4 pt-2 pb-6 md:max-w-3xl md:pb-2">
				<ChatInput
					chatId={id}
					zedToken={zedToken}
					status={status}
					sendMessage={sendMessage}
					messages={messages}
					chatLength={messages.length}
				/>
			</div>
		</div>
	);
};

export { Chat };
