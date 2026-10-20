import { useChat } from "@ai-sdk/react";
import type { ChatId, ChatMessageId } from "@orcai/core";
import type { ChatBranchLink, ClientToolOutput } from "@orcai/schema";
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
import { assistantLinkSafety } from "@/components/assistant/assistant-link-safety";
import { AssistantPlaceholder } from "@/components/assistant/assistant-placeholder";
import {
	hasClientToolOutput,
	isClientToolPart,
} from "@/lib/ai/tools/assistant/client-tools";
import {
	ASSISTANT_TOOL_GROUPS,
	DEFERRED_TOOL_GROUPS,
} from "@/lib/ai/tools/assistant/groups";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { clientEnv } from "@/lib/env/client";
import {
	describeError,
	errorReasonOf,
	reasonMessageOf,
} from "@/lib/errors/describe-error";
import { client, orpc } from "@/lib/orpc/orpc";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";
import { BranchedFrom } from "./branch-links";
import type { ChatDraft } from "./chat-draft";
import { toChatAgentMessages } from "./chat-history";
import { ChatInput } from "./chat-input";
import { ChatPlaceholder } from "./chat-placeholder";
import { shouldContinueTurn } from "./continue-turn";
import { EarlierMessages } from "./earlier-messages";
import { isToolPart, pausedStep } from "./message/classify-turn";
import { MessageBlock } from "./message/message-block";
import { useBranchChat } from "./message/use-branch-chat";

const assistantLinks = assistantLinkSafety(clientEnv.VITE_WEB_URL);

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

/** Approval and client call ids already answered in stored rows, which the server holds. */
const storedAnswers = (messages: ChatAgentUIMessage[]) =>
	messages.flatMap((message) =>
		message.parts.filter(isToolPart).flatMap((part) => {
			if (part.approval && part.state !== "approval-requested") {
				return [
					part.approval.id,
				];
			}

			return hasClientToolOutput(part)
				? [
						part.toolCallId,
					]
				: [];
		}),
	);

/** The last step's answers given on this page; a step answered before a reload sends none. */
const newDecisions = (message: ChatAgentUIMessage, stored: Set<string>) => {
	const paused = pausedStep(message.parts, false);

	return paused
		? message.parts
				.slice(paused.start)
				.filter(isToolPart)
				.flatMap((part) =>
					part.state === "approval-responded" && !stored.has(part.approval.id)
						? [
								{
									approvalId: part.approval.id,
									approved: part.approval.approved,
									reason: part.approval.reason,
								},
							]
						: [],
				)
		: [];
};

/** The last step's client call results given on this page, never the parts themselves. */
const newToolOutputs = (message: ChatAgentUIMessage, stored: Set<string>) => {
	const paused = pausedStep(message.parts, false);

	return paused
		? message.parts
				.slice(paused.start)
				.filter(isClientToolPart)
				.flatMap((part): ClientToolOutput[] => {
					if (stored.has(part.toolCallId)) {
						return [];
					}

					switch (part.state) {
						case "output-available":
							return [
								{
									toolCallId: part.toolCallId,
									output: part.output,
								},
							];
						case "output-error":
							return [
								{
									toolCallId: part.toolCallId,
									errorText: part.errorText,
								},
							];
						default:
							return [];
					}
				})
		: [];
};

/**
 * The server holds the history, so only the new user message travels, or for
 * an assistant row the answers to its last step.
 */
const openTurn = (
	message: ChatAgentUIMessage | undefined,
	turn: {
		chatId: ChatId;
		zedToken?: string;
		/** What a client call's write returned while answering the step. */
		answerZedToken?: string;
		storedAnswerIds: Set<string>;
	},
	options: {
		signal: AbortSignal;
	},
) => {
	switch (message?.role) {
		case "user":
			return client.ai.chat(
				{
					chatId: turn.chatId,
					message: {
						...message,
						role: "user",
					},
					zedToken: turn.zedToken,
				},
				options,
			);
		case "assistant":
			return client.ai.continue(
				{
					chatId: turn.chatId,
					messageId: message.id,
					approvals: newDecisions(message, turn.storedAnswerIds),
					toolOutputs: newToolOutputs(message, turn.storedAnswerIds),
					zedToken: turn.answerZedToken,
				},
				options,
			);
		default:
			throw new Error("Only a user message or answers can be sent");
	}
};

const PLATFORM_TOOL_TYPES = new Set<string>(
	DEFERRED_TOOL_GROUPS.flatMap((group) => ASSISTANT_TOOL_GROUPS[group]).map(
		(name) => `tool-${name}`,
	),
);

/** A bots, sharing or people tool ran, so pages showing that data are stale. */
const changedPlatformData = (message: ChatAgentUIMessage) =>
	message.parts.some(
		(part) =>
			PLATFORM_TOOL_TYPES.has(part.type) &&
			isToolPart(part) &&
			part.state === "output-available",
	);

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
	const storedAnswerIds = useRef(new Set(storedAnswers(initialMessages)));
	// The newest token seen: the page's, a turn's, then a widget's write.
	const newestZedToken = useRef(zedToken);
	// A widget's write in the paused step; its token also covers the paused turn's writes.
	const answerZedToken = useRef<string | undefined>(undefined);
	const keepZedToken = (token: string | undefined) => {
		if (token) {
			newestZedToken.current = token;
		}
	};
	const keepAnswerZedToken = (token: string | undefined) => {
		keepZedToken(token);
		answerZedToken.current = token ?? answerZedToken.current;
	};
	useEffect(() => {
		if (zedToken) {
			newestZedToken.current = zedToken;
		}
	}, [
		zedToken,
	]);

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

	const {
		messages,
		status,
		setMessages,
		sendMessage,
		stop,
		addToolApprovalResponse,
		addToolOutput,
	} = useChat<ChatAgentUIMessage>({
		id,
		generateId: () => crypto.randomUUID(),
		sendAutomaticallyWhen: shouldContinueTurn,
		transport: {
			async sendMessages(options) {
				// Stop cuts the stream only once the server has answered, so the reply is already reserved.
				const request = new AbortController();
				const events = await openTurn(
					options.messages.at(-1),
					{
						chatId: options.chatId as ChatId,
						zedToken: newestZedToken.current,
						answerZedToken: answerZedToken.current,
						storedAnswerIds: storedAnswerIds.current,
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
			keepZedToken(message.metadata?.zedToken);
			if (!isAbort && !isDisconnect && !isError) {
				answerZedToken.current = undefined;
			}
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
			if (changedPlatformData(message)) {
				await Promise.all(
					[
						orpc.bot,
						orpc.block,
						orpc.asset,
						orpc.job,
						orpc.resource,
						orpc.group,
						orpc.organizationMember,
						orpc.organizationInvitation,
						orpc.user,
						orpc.authorization,
					].map((namespace) =>
						queryClient.invalidateQueries({
							queryKey: namespace.key(),
							refetchType: "active",
						}),
					),
				);
			}
		},
		onError: (error) => {
			setErrorDetail(describeError(error));
			if (errorReasonOf(error)?.reason === "CHAT_TURN_NOT_AWAITING") {
				void reloadLatestMessages();
			}
		},
	});

	/** Replaces the newest page with the stored rows, as another tab left them. */
	const reloadLatestMessages = async () => {
		const page = await client.chatMessage.list({
			chatId: id,
			zedToken,
		});
		const stored = toChatAgentMessages(page.data);
		const storedIds = new Set(stored.map((message) => message.id));
		for (const message of stored) {
			loadedMessageIds.current.add(message.id);
		}
		for (const answerId of storedAnswers(stored)) {
			storedAnswerIds.current.add(answerId);
		}
		setMessages((current) => [
			...current.filter((message) => !storedIds.has(message.id)),
			...stored,
		]);
	};

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
							linkSafety={isAssistant ? assistantLinks : undefined}
							addToolApprovalResponse={
								index === messages.length - 1
									? addToolApprovalResponse
									: undefined
							}
							clientToolActions={
								index === messages.length - 1
									? {
											addToolOutput,
											keepZedToken: keepAnswerZedToken,
										}
									: undefined
							}
							onContinue={
								index === messages.length - 1 &&
								(status === "ready" || status === "error")
									? () => void sendMessage()
									: undefined
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
