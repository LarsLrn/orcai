import { useChat } from "@ai-sdk/react";
import type { ChatId } from "@orcai/core";
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
import { describeError, reasonMessageOf } from "@/lib/errors/describe-error";
import { client, orpc } from "@/lib/orpc/orpc";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";
import { ChatInput } from "./chat-input";
import { ChatPlaceholder } from "./chat-placeholder";
import { EarlierMessages } from "./earlier-messages";
import { MessageBlock } from "./message/message-block";

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
		<p className="px-1 text-accent-brand text-xs tabular-nums">
			{badge.meteringMode === "requests"
				? m.chat_quota_requests_left({
						pool: badge.poolName ?? m.chat_quota_pool_fallback_name(),
						amount: formatCount(badge.remainingAmount),
						count: badge.remainingAmount,
					})
				: m.chat_quota_tokens_left({
						pool: badge.poolName ?? m.chat_quota_pool_fallback_name(),
						amount: formatCount(badge.remainingAmount),
						count: badge.remainingAmount,
					})}
		</p>
	);
};

const Chat = ({
	id,
	initialMessages,
	initialBefore,
	initialHasMore,
	zedToken,
	pendingMessage,
}: {
	id: ChatId;
	initialMessages: ChatAgentUIMessage[];
	/** Position of the oldest loaded message, the cursor for the next older page. */
	initialBefore?: number;
	initialHasMore: boolean;
	zedToken?: string;
	pendingMessage?: string;
}) => {
	const queryClient = useQueryClient();
	const hasSentPendingMessage = useRef(false);
	const [errorDetail, setErrorDetail] = useState<string | undefined>(undefined);
	// Only messages that arrive during this visit animate in.
	const loadedMessageIds = useRef(
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
			generateId: () => crypto.randomUUID(),
			transport: {
				async sendMessages(options) {
					// The server holds the history, so only the new user message travels.
					const message = options.messages.at(-1);
					if (message?.role !== "user") {
						throw new Error("Only a user message can be sent");
					}

					return eventIteratorToUnproxiedDataStream(
						await client.ai.chat(
							{
								chatId: options.chatId as ChatId,
								message: {
									...message,
									role: "user",
								},
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
				setErrorDetail(describeError(error));
			},
		});

	const prependMessages = (older: ChatAgentUIMessage[]) => {
		for (const message of older) {
			loadedMessageIds.current.add(message.id);
		}
		setMessages((current) => {
			const currentIds = new Set(current.map((message) => message.id));
			return [
				...older.filter((message) => !currentIds.has(message.id)),
				...current,
			];
		});
	};

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
			toast.error(m.chat_pending_message_failed_toast_error(), {
				description: reasonMessageOf(error),
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
				<ConversationContent
					className="mx-auto w-full max-w-200"
					scrollClassName="[overflow-anchor:none]"
				>
					<EarlierMessages
						chatId={id}
						zedToken={zedToken}
						initialBefore={initialBefore}
						initialHasMore={initialHasMore}
						firstMessageId={messages[0]?.id}
						onLoad={prependMessages}
					/>
					{messages.map((m, index) => (
						<MessageBlock
							key={m.id}
							message={m}
							chatId={id}
							setMessages={setMessages}
							regenerate={regenerate}
							status={status}
							isLatest={index === messages.length - 1}
							animate={!loadedMessageIds.current.has(m.id)}
						/>
					))}
					{messages.length === 0 && <ChatPlaceholder />}
					{status === "submitted" && (
						<div className="w-full text-foreground">
							<Shimmer>{m.chat_waiting_for_model()}</Shimmer>
						</div>
					)}
					{status === "error" && (
						<div
							role="alert"
							className="w-full space-y-1 rounded-xl bg-destructive/10 px-4 py-3 text-sm"
						>
							<p className="text-destructive">{m.chat_response_failed()}</p>
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
				/>
			</div>
		</div>
	);
};

export { Chat };
