import { useChat } from "@ai-sdk/react";
import type { ChatBranchId, ChatId } from "@orcai/core";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { client, orpc } from "@/lib/orpc/orpc";
import { formatCount } from "@/lib/presentation/format-number";
import { ChatInput } from "./chat-input";
import { ChatPlaceholder } from "./chat-placeholder";
import { MessageBlock } from "./message/message-block";

const MODEL_DID_NOT_RESPOND =
	"The model did not respond. Send the message again or choose another model.";

/** Quota is a governance fact, so it sits in the accent, above the composer. */
const QuotaLine = ({ chatId }: { chatId: ChatId }) => {
	const { data } = useQuery(
		orpc.quota.chatBadge.queryOptions({
			input: {
				chatId,
			},
		}),
	);
	const badge = data?.data;

	if (!badge?.poolId || badge.remainingAmount === null) {
		return null;
	}

	return (
		<p className="px-1 text-accent-brand text-xs">
			{badge.poolName ?? "Quota"} pool ·{" "}
			<span className="tabular-nums">{formatCount(badge.remainingAmount)}</span>{" "}
			{badge.meteringMode === "requests" ? "requests" : "tokens"} left
		</p>
	);
};

const Chat = ({
	id,
	initialMessages,
	branchId,
	zedToken,
	pendingMessage,
}: {
	id: ChatId;
	initialMessages: ChatAgentUIMessage[];
	branchId?: ChatBranchId;
	zedToken?: string;
	pendingMessage?: string;
}) => {
	const queryClient = useQueryClient();
	const hasSentPendingMessage = useRef(false);
	const [errorDetail, setErrorDetail] = useState<string | undefined>(undefined);
	const initialMessageIds = useRef(
		new Set(initialMessages.map((message) => message.id)),
	);

	const quotaBadgeQueryOptions = orpc.quota.chatBadge.queryOptions({
		input: {
			chatId: id,
		},
	});

	const { messages, status, setMessages, regenerate, sendMessage, stop } =
		useChat<ChatAgentUIMessage>({
			id,
			transport: {
				async sendMessages(options) {
					return eventIteratorToUnproxiedDataStream(
						await client.ai.chat(
							{
								chatId: options.chatId as ChatId,
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
				// Refreshes the chat list, activeBranchId and branches once a response lands
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
				await queryClient.invalidateQueries({
					queryKey: quotaBadgeQueryOptions.queryKey,
					refetchType: "active",
				});
			},
			onError: (error) => {
				setErrorDetail(error.message);
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
			toast.error("The message was not sent. Send it again.", {
				description: error instanceof Error ? error.message : undefined,
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
			<Conversation className="flex w-full" initial="instant">
				<ConversationContent className="mx-auto w-full max-w-200">
					{messages.map((m, index) => (
						<MessageBlock
							key={m.id}
							message={m}
							chatId={id}
							setMessages={setMessages}
							regenerate={regenerate}
							status={status}
							isLatest={index === messages.length - 1}
							animate={!initialMessageIds.current.has(m.id)}
						/>
					))}
					{messages.length === 0 && <ChatPlaceholder />}
					{status === "submitted" && (
						<div className="w-full text-foreground">
							<Shimmer>Waiting for the model</Shimmer>
						</div>
					)}
					{status === "error" && (
						<div
							role="alert"
							className="w-full space-y-1 rounded-xl bg-destructive/10 px-4 py-3 text-sm"
						>
							<p className="text-destructive">{MODEL_DID_NOT_RESPOND}</p>
							{errorDetail && (
								<p className="wrap-anywhere text-muted-foreground text-xs">
									{errorDetail}
								</p>
							)}
						</div>
					)}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>

			<div className="mx-auto flex w-full flex-col gap-2 px-4 pt-2 pb-6 md:max-w-3xl md:pb-2">
				<QuotaLine chatId={id} />
				<ChatInput
					chatId={id}
					zedToken={zedToken}
					status={status}
					sendMessage={sendMessage}
					stop={stop}
					messages={messages}
				/>
			</div>
		</div>
	);
};

export { Chat };
