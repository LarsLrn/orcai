import type { ChatId } from "@orcai/core";
import type { ChatBranchLink } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
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
import { PlanPanel } from "@/components/assistant/plan-panel";
import { DocumentsPanel } from "@/components/documents/readiness/documents-panel";
import { useChatRepositoryIds } from "@/components/documents/readiness/use-repository-readiness";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { turnView } from "@/lib/ai/turn-view/turn-view";
import { clientEnv } from "@/lib/env/client";
import { describeError, reasonMessageOf } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";
import { BranchedFrom } from "./branch-links";
import type { ChatDraft } from "./chat-draft";
import { ChatInput } from "./chat-input";
import { ChatPlaceholder } from "./chat-placeholder";
import { EarlierMessages } from "./earlier-messages";
import { MessageBlock } from "./message/message-block";
import { useBranchChat } from "./message/use-branch-chat";
import { StepAnswersContext } from "./step-answers";
import { useChatSession } from "./use-chat-session";

const assistantLinks = assistantLinkSafety(clientEnv.VITE_WEB_URL);

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
	page,
	zedToken,
	pendingMessage,
	draft,
	variant = "chat",
}: {
	id: ChatId;
	/** The newest page as the loader fetched it. */
	page: Parameters<typeof useChatSession>[0]["page"];
	zedToken?: string;
	pendingMessage?: string;
	draft?: ChatDraft;
	/** Assistant conversations drop the chat-only controls. */
	variant?: "chat" | "assistant";
}) => {
	const isAssistant = variant === "assistant";
	const { session, messages, phase, error } = useChatSession({
		chatId: id,
		page,
		zedToken,
		variant,
	});

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
	const repositoryIds = useChatRepositoryIds({
		chatId: id,
		botId: chat?.data.botId,
	});

	const view = turnView(messages, phase);
	const canBranch = !isAssistant && !view.busy;
	const branchFrom = (messageId: string) => {
		if (branchChat.isPending) return;
		branchChat.mutate({
			chatId: id,
			messageId,
			zedToken,
		});
	};

	useEffect(() => {
		if (!pendingMessage) return;
		session.sendFirst(pendingMessage)?.catch((error: unknown) => {
			toast.error(m.chat_pending_message_failed_toast_error(), {
				description: reasonMessageOf(error),
			});
		});
	}, [
		session,
		pendingMessage,
	]);

	const composer = (
		<ChatInput
			chatId={id}
			zedToken={zedToken}
			phase={phase}
			send={session.send}
			stop={session.stop}
			draft={draft}
			variant={variant}
		/>
	);

	return (
		<StepAnswersContext value={session.answers}>
			<div className="flex size-full min-h-0 min-w-0 flex-col">
				{!isAssistant && chat?.data.parentChat && (
					<div className="mx-auto flex w-full max-w-200 px-4 pb-2">
						<BranchedFrom parentChat={chat.data.parentChat} />
					</div>
				)}
				<Conversation>
					<EarlierMessages
						hasEarlier={session.hasEarlier}
						loadEarlier={session.loadEarlier}
						firstMessageId={messages[0]?.id}
					/>
					<ConversationContent className="mx-auto w-full max-w-200">
						{view.messages.map((messageView) => {
							const { id: messageId, role } = messageView.message;
							return (
								<MessageScrollerItem
									key={messageId}
									messageId={messageId}
									scrollAnchor={role === "user"}
								>
									<MessageBlock
										view={messageView}
										chatId={id}
										animate={!session.wasLoaded(messageId)}
										branches={branchesByMessage.get(messageId)}
										onBranch={
											canBranch ? () => branchFrom(messageId) : undefined
										}
										branching={
											branchChat.isPending &&
											branchChat.variables?.messageId === messageId
										}
										linkSafety={isAssistant ? assistantLinks : undefined}
									/>
								</MessageScrollerItem>
							);
						})}
						{messages.length === 0 && (
							<MessageScrollerItem className="flex flex-1 flex-col justify-center">
								{isAssistant ? (
									<AssistantPlaceholder className="h-full justify-center" />
								) : (
									<ChatPlaceholder />
								)}
							</MessageScrollerItem>
						)}
						{phase === "sending" && (
							<MessageScrollerItem className="w-full text-foreground">
								<Shimmer>{m.chat_waiting_for_model()}</Shimmer>
							</MessageScrollerItem>
						)}
						{phase === "error" && (
							<MessageScrollerItem
								role="alert"
								className="w-full space-y-1 rounded-xl bg-destructive/10 px-4 py-3 text-sm"
							>
								<p className="text-destructive">{m.chat_response_failed()}</p>
								{error && (
									<p className="wrap-anywhere text-muted-foreground text-xs">
										{describeError(error)}
									</p>
								)}
							</MessageScrollerItem>
						)}
					</ConversationContent>
					<ConversationScrollButton />
				</Conversation>

				<div className="mx-auto flex w-full flex-col gap-2 px-4 pt-2 pb-6 md:max-w-3xl md:pb-2">
					<QuotaLine chatId={id} />
					{isAssistant ? (
						<>
							<PlanPanel plan={view.plan} busy={view.busy} />
							<DocumentsPanel blockIds={repositoryIds} />
							<AssistantComposerGate>{composer}</AssistantComposerGate>
						</>
					) : (
						<>
							<DocumentsPanel blockIds={repositoryIds} />
							{composer}
						</>
					)}
				</div>
			</div>
		</StepAnswersContext>
	);
};

export { Chat };
