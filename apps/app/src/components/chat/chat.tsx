import type { ChatId } from "@orcai/core";
import type { ChatBranchLink, ChatKind } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import {
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useMemo,
	useState,
} from "react";
import {
	Conversation,
	ConversationContent,
} from "@/components/ai-elements/conversation";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { AssetsPanel } from "@/components/assets/readiness/assets-panel";
import { useChatRepositoryIds } from "@/components/assets/readiness/use-repository-readiness";
import { AssistantComposerGate } from "@/components/assistant/assistant-composer-gate";
import { AssistantModelLabel } from "@/components/assistant/assistant-model-label";
import { AssistantPlaceholder } from "@/components/assistant/assistant-placeholder";
import { PlanPanel } from "@/components/assistant/plan-panel";
import { WebSearchNotice } from "@/components/chat/web-search-notice";
import { ChatEmbeddingsRebuildNotice } from "@/components/instance/settings/embeddings-rebuild-notice";
import {
	chatLinkSafety,
	LinkSafetyContext,
} from "@/components/ui/composed/link-confirm";
import {
	MessageScrollerButton,
	MessageScrollerItem,
	useMessageScroller,
} from "@/components/ui/message-scroller";
import { usePublicConfig } from "@/hooks/use-public-config";
import { turnView } from "@/lib/ai/messages/turn-view";
import { describeError } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { ChatPlaceholder } from "./chat-placeholder";
import { ChatReadOnlyNotice } from "./chat-read-only-notice";
import { type ChatDraft, outgoingMessageOf } from "./composer/chat-draft";
import { ChatModelPicker } from "./composer/chat-model-picker";
import { Composer } from "./composer/composer";
import { SendMessageContext } from "./composer/send-message";
import { useComposerSendState } from "./composer/use-composer-send-state";
import { useOpeningMessage } from "./composer/use-opening-message";
import { EarlierMessages } from "./earlier-messages";
import { BranchedFrom } from "./message/branch-links";
import { MessageBlock } from "./message/message-block";
import { StepAnswersContext } from "./message/step-answers";
import { useBranchChat } from "./message/use-branch-chat";
import { useChatSession } from "./use-chat-session";

const HIGHLIGHT_MS = 2000;

/** Opens the conversation on a message instead of its end. */
const ScrollToMessage = ({ messageId }: { messageId: string }) => {
	const { scrollToMessage } = useMessageScroller();
	const scroll = useEffectEvent(() =>
		scrollToMessage(messageId, {
			align: "center",
		}),
	);

	// Before paint, so the conversation never shows its end first.
	useLayoutEffect(() => {
		scroll();
	}, []);

	return null;
};

const Chat = ({
	id,
	page,
	zedToken,
	focusMessageId,
	pendingMessage,
	draft,
	kind,
}: {
	id: ChatId;
	/** The newest page as the loader fetched it. */
	page: Parameters<typeof useChatSession>[0]["page"];
	zedToken?: string;
	/** A message to open on and highlight briefly. */
	focusMessageId?: string;
	/** The opening message of a chat just created, sent once. */
	pendingMessage?: ChatDraft;
	draft?: ChatDraft;
	/** Assistant conversations drop the chat-only controls. */
	kind: ChatKind;
}) => {
	const isAssistant = kind === "assistant";
	const { docsUrl } = usePublicConfig();
	const linkSafety = useMemo(
		() =>
			chatLinkSafety({
				docsUrl,
				appPaths: isAssistant,
			}),
		[
			docsUrl,
			isAssistant,
		],
	);
	const { session, messages, phase, error } = useChatSession({
		chatId: id,
		page,
		zedToken,
		kind,
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

	const [highlightedId, setHighlightedId] = useState(focusMessageId);
	useEffect(() => {
		if (!highlightedId) return;
		const timeout = setTimeout(() => setHighlightedId(undefined), HIGHLIGHT_MS);
		return () => clearTimeout(timeout);
	}, [
		highlightedId,
	]);

	const readOnly = chat?.data.readOnly ?? null;
	const view = turnView(messages, phase);
	const canBranch = !isAssistant && !view.busy && readOnly === null;
	const branchFrom = (messageId: string) => {
		if (branchChat.isPending) return;
		branchChat.mutate({
			chatId: id,
			messageId,
			zedToken,
		});
	};

	const sendState = useComposerSendState({
		chat: chat?.data,
		kind,
	});

	const composerDraft = useOpeningMessage({
		session,
		pendingMessage,
		draft,
	});

	const composer = (
		<Composer
			key={composerDraft.version}
			draft={composerDraft.draft}
			onSend={(message) => session.send(outgoingMessageOf(message))}
			withAttachments={!isAssistant}
			assistant={isAssistant}
			model={sendState.selectedModel}
			blocker={sendState.blocker}
			turn={{
				phase,
				stop: session.stop,
			}}
			contextTokens={view.contextTokens}
			tools={(held) =>
				isAssistant ? (
					<AssistantModelLabel />
				) : (
					<ChatModelPicker
						chatId={id}
						botId={chat?.data.botId}
						effectiveModel={chat?.data.effectiveModel}
						disabled={held}
					/>
				)
			}
		>
			{!isAssistant &&
				!sendState.isModelConfigured &&
				sendState.blocker?.reason !== "bot-model" && (
					<p className="text-muted-foreground text-xs">
						{m.chat_composer_model_required_hint()}
					</p>
				)}
		</Composer>
	);
	// Prefilled replies send as the composer does: not while a turn runs, the chat is read-only or sending is blocked.
	const sendReply =
		sendState.canSend && !view.busy
			? (text: string) =>
					session.send({
						text,
					})
			: undefined;

	return (
		<StepAnswersContext value={session.answers}>
			<LinkSafetyContext value={linkSafety}>
				<SendMessageContext value={sendReply}>
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
											data-highlighted={
												messageId === highlightedId || undefined
											}
											className={cn(
												focusMessageId &&
													"data-highlighted:bg-accent-brand/10 rounded-xl transition-colors duration-700",
											)}
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
									<MessageScrollerItem className="text-foreground w-full">
										<Shimmer>{m.chat_waiting_for_model()}</Shimmer>
									</MessageScrollerItem>
								)}
								{phase === "error" && (
									<MessageScrollerItem
										role="alert"
										className="bg-destructive/10 w-full space-y-1 rounded-xl px-4 py-3 text-sm"
									>
										<p className="text-destructive">
											{isAssistant
												? m.assistant_response_failed()
												: m.chat_response_failed()}
										</p>
										{error && (
											<p className="text-muted-foreground text-xs wrap-anywhere">
												{describeError(error)}
											</p>
										)}
									</MessageScrollerItem>
								)}
							</ConversationContent>
							<MessageScrollerButton />
							{focusMessageId && <ScrollToMessage messageId={focusMessageId} />}
						</Conversation>

						<div className="mx-auto flex w-full flex-col gap-2 px-4 pt-2 pb-6 md:max-w-3xl md:pb-2">
							{readOnly !== null && chat ? (
								<ChatReadOnlyNotice
									reason={readOnly}
									organizationName={chat.data.organization.name}
								/>
							) : isAssistant ? (
								<>
									<PlanPanel plan={view.plan} busy={view.busy} />
									<AssetsPanel blockIds={repositoryIds} />
									<AssistantComposerGate>{composer}</AssistantComposerGate>
								</>
							) : (
								<>
									<WebSearchNotice
										botId={chat?.data.botId}
										providerId={
											chat?.data.effectiveModel.providerId ?? undefined
										}
									/>
									<ChatEmbeddingsRebuildNotice repositoryIds={repositoryIds} />
									<AssetsPanel blockIds={repositoryIds} />
									{composer}
								</>
							)}
						</div>
					</div>
				</SendMessageContext>
			</LinkSafetyContext>
		</StepAnswersContext>
	);
};

export { Chat };
