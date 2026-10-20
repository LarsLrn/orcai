import { useChat } from "@ai-sdk/react";
import type { ChatId, ChatMessageId } from "@orcai/core";
import type { ChatBranchLink } from "@orcai/schema";
import { eventIteratorToUnproxiedDataStream, ORPCError } from "@orpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { AssistantComposerGate } from "@/components/assistant/assistant-composer-gate";
import { AssistantPlaceholder } from "@/components/assistant/assistant-placeholder";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { describeError, reasonMessageOf } from "@/lib/errors/describe-error";
import { client, orpc } from "@/lib/orpc/orpc";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";
import { BranchedFrom } from "./branch-links";
import type { ChatDraft } from "./chat-draft";
import { ChatInput } from "./chat-input";
import { ChatPlaceholder } from "./chat-placeholder";
import { EarlierMessages } from "./earlier-messages";
import { MessageBlock } from "./message/message-block";
import { useBranchChat } from "./message/use-branch-chat";

/** Resolves once a reply is filled in or dropped, so the next turn's context includes it. */
const waitForStoredReply = async (input: {
	chatId: ChatId;
	id: ChatMessageId;
	zedToken?: string;
}) => {
	for (let attempt = 0; attempt < 40; attempt++) {
		try {
			const reply = await client.chatMessage.find(input);
			if (reply.data.parts.length > 0) return;
		} catch (error) {
			// Dropped because the turn produced nothing; other failures are retried.
			if (error instanceof ORPCError && error.code === "NOT_FOUND") return;
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
};

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
	draft,
	variant = "chat",
}: {
	id: ChatId;
	initialMessages: ChatAgentUIMessage[];
	/** Position of the oldest loaded message, the cursor for the next older page. */
	initialBefore?: number;
	initialHasMore: boolean;
	zedToken?: string;
	pendingMessage?: string;
	draft?: ChatDraft;
	/** Assistant conversations drop the chat-only controls. */
	variant?: "chat" | "assistant";
}) => {
	const isAssistant = variant === "assistant";
	const queryClient = useQueryClient();
	const hasSentPendingMessage = useRef(false);
	const [errorDetail, setErrorDetail] = useState<string | undefined>(undefined);
	const [isStoringReply, setIsStoringReply] = useState(false);
	// Only messages that arrive during this visit animate in.
	const loadedMessageIds = useRef(
		new Set(initialMessages.map((message) => message.id)),
	);

	const { data: chat } = useQuery(
		orpc.chat.find.queryOptions({
			input: {
				id,
				zedToken,
			},
		}),
	);
	const branchesByMessage = useMemo(() => {
		const byMessage = new Map<string, ChatBranchLink[]>();
		for (const branch of chat?.data.branches ?? []) {
			byMessage.set(branch.branchedFromMessageId, [
				...(byMessage.get(branch.branchedFromMessageId) ?? []),
				branch,
			]);
		}
		return byMessage;
	}, [
		chat?.data.branches,
	]);
	const branchChat = useBranchChat();

	const quotaBadgeQueryOptions = orpc.quota.chatBadge.queryOptions({
		input: {
			chatId: id,
		},
	});

	const { messages, status, setMessages, sendMessage, stop } =
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

					// Stop cuts the stream only once the server has answered, so the reply is already reserved.
					const request = new AbortController();
					const events = await client.ai.chat(
						{
							chatId: options.chatId as ChatId,
							message: {
								...message,
								role: "user",
							},
							zedToken,
						},
						{
							signal: request.signal,
						},
					);
					if (options.abortSignal?.aborted) {
						request.abort();
					}
					options.abortSignal?.addEventListener("abort", () => request.abort());

					return eventIteratorToUnproxiedDataStream(events);
				},
				reconnectToStream() {
					throw new Error("Unsupported");
				},
			},
			messages: initialMessages,
			onFinish: async ({ message, isAbort, isDisconnect, isError }) => {
				// A finished stream closes after the reply is stored; any other ending may still be saving.
				if (isAbort || isDisconnect || isError) {
					setIsStoringReply(true);
					await waitForStoredReply({
						chatId: id,
						id: message.id as ChatMessageId,
						zedToken,
					}).finally(() => setIsStoringReply(false));
				}
				// Refreshes the chat list and the auto-title once a response lands
				await queryClient.invalidateQueries({
					queryKey: orpc.chat.key(),
					refetchType: "active",
				});
				await queryClient.invalidateQueries({
					queryKey: quotaBadgeQueryOptions.queryKey,
					refetchType: "active",
				});
				if (isAssistant) {
					await queryClient.invalidateQueries({
						queryKey: orpc.assistant.key(),
						refetchType: "active",
					});
				}
			},
			onError: (error) => {
				setErrorDetail(describeError(error));
			},
		});

	const canBranch = !isAssistant && (status === "ready" || status === "error");
	const branchFrom = (messageId: string) => {
		if (branchChat.isPending) return;
		branchChat.mutate({
			chatId: id,
			messageId,
			zedToken,
		});
	};

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

	const composer = (
		<ChatInput
			chatId={id}
			zedToken={zedToken}
			status={status}
			isStoringReply={isStoringReply}
			sendMessage={sendMessage}
			stop={stop}
			draft={draft}
			variant={variant}
		/>
	);

	return (
		<div className="flex size-full min-h-0 min-w-0 flex-col">
			{!isAssistant && chat?.data.parentChat && (
				<div className="mx-auto flex w-full max-w-200 px-4 pb-2">
					<BranchedFrom parentChat={chat.data.parentChat} />
				</div>
			)}
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
							status={status}
							isLatest={index === messages.length - 1}
							animate={!loadedMessageIds.current.has(m.id)}
							branches={branchesByMessage.get(m.id)}
							onBranch={canBranch ? () => branchFrom(m.id) : undefined}
							branching={
								branchChat.isPending && branchChat.variables?.messageId === m.id
							}
						/>
					))}
					{messages.length === 0 &&
						(isAssistant ? (
							<AssistantPlaceholder className="h-full justify-center" />
						) : (
							<ChatPlaceholder />
						))}
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
				{isAssistant ? (
					<AssistantComposerGate>{composer}</AssistantComposerGate>
				) : (
					composer
				)}
			</div>
		</div>
	);
};

export { Chat };
