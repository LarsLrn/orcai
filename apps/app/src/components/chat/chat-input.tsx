import type { ChatId } from "@orcai/core";
import {
	CHAT_MESSAGE_ATTACHMENT_LIMIT,
	type Model,
	type Provider,
} from "@orcai/schema";
import { skipToken, useQuery } from "@tanstack/react-query";
import type { ChatStatus } from "ai";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
	PromptInputSubmit,
	PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { AssistantModelLabel } from "@/components/assistant/assistant-model-label";
import { useAssistantModel } from "@/components/assistant/use-assistant-model";
import { ChatAttachmentActionMenu } from "@/components/chat/attachments/chat-attachment-action-menu";
import { ChatComposerAttachments } from "@/components/chat/attachments/chat-attachment-input";
import { useChatAttachments } from "@/components/chat/attachments/use-chat-attachments";
import { ChatAssetPicker } from "@/components/chat/chat-asset-picker";
import type { ChatDraft } from "@/components/chat/chat-draft";
import { ChatModelNotice } from "@/components/chat/chat-model-notice";
import { composerBlocker } from "@/components/chat/composer-blocker";
import { ModelPicker } from "@/components/chat/model-picker";
import { modelPickerState } from "@/components/chat/model-picker-state";
import { UsageIndicator } from "@/components/chat/usage/usage-indicator";
import { useQuotaStatus } from "@/components/quota/use-quota-status";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import { useUpdateChatMutation } from "@/hooks/mutations/use-chat-mutation";
import type { ChatSession } from "@/lib/ai/chat-session/chat-session";
import type { ChatPhase } from "@/lib/ai/turn-view/turn-view";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { CHAT_ATTACHMENT_ACCEPT } from "@/settings/constants";

const submitStatuses: Record<ChatPhase, ChatStatus> = {
	idle: "ready",
	sending: "submitted",
	streaming: "streaming",
	storing: "submitted",
	error: "error",
};

const ChatInput = ({
	chatId,
	zedToken,
	phase,
	send,
	stop,
	draft,
	contextTokens,
	variant = "chat",
}: {
	chatId: ChatId;
	zedToken?: string;
	/** While `storing`, a stopped or failed reply is still being saved, so the next message waits. */
	phase: ChatPhase;
	send: ChatSession["send"];
	stop: ChatSession["stop"];
	/** Prefills the composer, e.g. with the message a branch started from. */
	draft?: ChatDraft;
	/** What the newest reply's context held. */
	contextTokens?: number;
	/** The assistant's model comes from the organisation, and it takes no attachments here. */
	variant?: "chat" | "assistant";
}) => {
	const isAssistant = variant === "assistant";
	const [messageText, setMessageText] = useState(draft?.text ?? "");

	const { data: chat } = useQuery(
		orpc.chat.find.queryOptions({
			input: {
				id: chatId,
				zedToken,
			},
		}),
	);
	const { data: bot } = useQuery(
		orpc.bot.find.queryOptions({
			input: chat?.data.botId
				? {
						id: chat.data.botId,
					}
				: skipToken,
		}),
	);
	const assistantModel = useAssistantModel();
	const effective = chat?.data.effectiveModel;
	const selectedModel = isAssistant
		? assistantModel
		: {
				providerId: effective?.providerId ?? undefined,
				modelId: effective?.modelId ?? undefined,
			};
	const { mutate: updateChat } = useUpdateChatMutation();
	const isModelConfigured = Boolean(
		selectedModel.modelId && selectedModel.providerId,
	);
	const { data: quota } = useQuotaStatus(selectedModel);
	// Blocks sending only; a running turn keeps its Stop.
	const blocker = composerBlocker({
		modelAvailable: true,
		quota: quota?.data,
		requiredBy:
			effective?.source === "bot-required" && chat?.data.botId
				? {
						botId: chat.data.botId,
						usable: effective.botSetup?.model?.usable === true,
					}
				: undefined,
	});
	const handleModelSelect = useCallback(
		(model: Model, provider: Provider) => {
			updateChat({
				id: chatId,
				config: {
					modelId: model.id,
					providerId: provider.id,
				},
			});
		},
		[
			chatId,
			updateChat,
		],
	);

	const {
		fileInputRef,
		localFiles,
		selectedAttachments,
		selectedAssetIds,
		canAttachMore,
		isUploading,
		assetPickerOpen,
		setAssetPickerOpen,
		openUploadDialog,
		handleFileInputChange,
		addAsset,
		removeLocalFile,
		removeSelectedAsset,
		clearAttachments,
		resolveAttachmentsForSend,
	} = useChatAttachments({
		limit: CHAT_MESSAGE_ATTACHMENT_LIMIT,
		initialAttachments: draft?.attachments,
	});

	const isGenerating = phase === "sending" || phase === "streaming";
	const isStoringReply = phase === "storing";
	const isBusy = isUploading || isStoringReply;
	const submitStatus: ChatStatus = isBusy ? "submitted" : submitStatuses[phase];

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const trimmedText = messageText.trim();
		const hasText = trimmedText.length > 0;
		const hasLocalFiles = localFiles.length > 0;
		const hasSelectedAttachments = selectedAttachments.length > 0;

		if (!(hasText || hasLocalFiles || hasSelectedAttachments)) {
			return;
		}

		if (isGenerating || isBusy || blocker) {
			return;
		}

		if (!isModelConfigured) {
			toast.error(m.chat_composer_model_required_toast_error());
			return;
		}

		setMessageText("");

		try {
			const attachments = await resolveAttachmentsForSend();

			if (!hasText && attachments.length === 0) {
				toast.error(m.chat_composer_attachments_missing_toast_error());
				return;
			}

			const sendPromise = send({
				text: hasText
					? trimmedText
					: m.chat_composer_attachments_only_message(),
				metadata:
					attachments.length > 0
						? {
								attachments,
							}
						: undefined,
			});

			clearAttachments();
			await sendPromise;
		} catch (error) {
			if (hasText) {
				setMessageText((current) => current || trimmedText);
			}
			toast.error(m.chat_composer_send_failed_toast_error(), {
				description: reasonMessageOf(error),
			});
		}
	};

	const handleTextareaKeyDown = (
		event: React.KeyboardEvent<HTMLTextAreaElement>,
	) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			event.currentTarget.form?.requestSubmit();
		}
	};

	return (
		<>
			{!isAssistant && (
				<input
					ref={fileInputRef}
					type="file"
					className="hidden"
					multiple
					accept={CHAT_ATTACHMENT_ACCEPT}
					onChange={handleFileInputChange}
				/>
			)}

			<form onSubmit={handleSubmit}>
				{/* The group clips its overflow, so the comet sits on a wrapper hugging its corners. */}
				<div
					className={cn(
						"[--loading-ring-radius:calc(var(--radius-3xl)+6px)]",
						(isGenerating || isStoringReply) && "loading-ring",
					)}
				>
					<InputGroup className="overflow-hidden border-border bg-card">
						{!isAssistant && (
							<ChatComposerAttachments
								localFiles={localFiles}
								attachments={selectedAttachments}
								onRemoveLocalFile={removeLocalFile}
								onRemoveAsset={removeSelectedAsset}
							/>
						)}

						<InputGroupTextarea
							name="message"
							aria-label={m.chat_composer_aria_label()}
							placeholder={m.chat_composer_placeholder()}
							className="field-sizing-content max-h-48 min-h-16"
							value={messageText}
							onChange={(event) => setMessageText(event.target.value)}
							onKeyDown={handleTextareaKeyDown}
							aria-describedby={blocker ? "chat-model-notice" : undefined}
						/>

						<InputGroupAddon
							align="block-end"
							className="justify-between gap-1"
						>
							<PromptInputTools>
								{isAssistant ? (
									<AssistantModelLabel />
								) : (
									<>
										<ChatAttachmentActionMenu
											disabled={!canAttachMore}
											onUploadFile={openUploadDialog}
											onSelectFromAssets={() => setAssetPickerOpen(true)}
										/>
										<ModelPicker
											state={
												effective
													? modelPickerState(effective)
													: {
															kind: "free",
														}
											}
											botName={bot?.data.name}
											selectedModelId={selectedModel.modelId ?? undefined}
											selectedProviderId={selectedModel.providerId ?? undefined}
											onSelect={handleModelSelect}
											className="max-w-32 sm:max-w-60"
										/>
									</>
								)}
							</PromptInputTools>

							<div className="flex shrink-0 items-center gap-1">
								<UsageIndicator
									providerId={selectedModel.providerId}
									modelId={selectedModel.modelId}
									contextTokens={contextTokens}
								/>
								<PromptInputSubmit
									status={submitStatus}
									onStop={() => void stop()}
									disabled={
										isBusy ||
										(!isGenerating &&
											(!isModelConfigured ||
												blocker !== undefined ||
												!(
													messageText.trim().length > 0 ||
													localFiles.length > 0 ||
													selectedAttachments.length > 0
												)))
									}
								/>
							</div>
						</InputGroupAddon>
					</InputGroup>
				</div>
				{!isAssistant &&
					!isModelConfigured &&
					blocker?.reason !== "bot-model" && (
						<p className="mt-2 text-muted-foreground text-xs">
							{m.chat_composer_model_required_hint()}
						</p>
					)}
				{blocker && <ChatModelNotice blocker={blocker} className="mt-3" />}
			</form>

			{!isAssistant && (
				<ChatAssetPicker
					open={assetPickerOpen}
					onOpenChange={setAssetPickerOpen}
					selectedAssetIds={selectedAssetIds}
					onAddAsset={addAsset}
					onRemoveAsset={removeSelectedAsset}
				/>
			)}
		</>
	);
};

export { ChatInput };
