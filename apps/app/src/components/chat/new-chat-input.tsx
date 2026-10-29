import type { BotId, ModelId, ProviderId } from "@orcai/core";
import {
	type BotSetup,
	CHAT_MESSAGE_ATTACHMENT_LIMIT,
	type ChatMessageAttachment,
	type Model,
	type Provider,
} from "@orcai/schema";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
	PromptInputSubmit,
	PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { ChatAttachmentActionMenu } from "@/components/chat/attachments/chat-attachment-action-menu";
import { ChatComposerAttachments } from "@/components/chat/attachments/chat-attachment-input";
import { useChatAttachments } from "@/components/chat/attachments/use-chat-attachments";
import { BotSelectorButton } from "@/components/chat/bot-selector";
import { ChatAssetPicker } from "@/components/chat/chat-asset-picker";
import type { ChatDraft } from "@/components/chat/chat-draft";
import { ChatModelNotice } from "@/components/chat/chat-model-notice";
import type { ComposerBlocker } from "@/components/chat/composer-blocker";
import { ModelPicker } from "@/components/chat/model-picker";
import { modelPickerState } from "@/components/chat/model-picker-state";
import { UsageIndicator } from "@/components/chat/usage/usage-indicator";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";
import { CHAT_ATTACHMENT_ACCEPT } from "@/settings/constants";

const blockedPlaceholders: Record<ComposerBlocker["reason"], () => string> = {
	model: m.chat_composer_placeholder_no_model,
	quota: m.chat_composer_placeholder_no_quota,
	"bot-model": m.chat_composer_placeholder_bot_model,
	exhausted: m.chat_composer_placeholder_quota_exhausted,
};

const NewChatInput = ({
	selectedBotId,
	selectedModelId,
	selectedProviderId,
	onBotSelect,
	onModelSelect,
	onSend,
	isCreating,
	blocker,
	setup,
}: {
	selectedBotId?: BotId;
	selectedModelId?: ModelId;
	selectedProviderId?: ProviderId;
	onBotSelect?: (botId?: BotId) => void;
	onModelSelect: (model: Model, provider: Provider) => void;
	/** Resolves whether the chat was created, so a failed send keeps the draft. */
	onSend: (message: ChatDraft) => Promise<boolean>;
	isCreating: boolean;
	blocker?: ComposerBlocker;
	/** The selected bot's setup, which fixes or recommends the model. */
	setup?: BotSetup | null;
}) => {
	const [messageText, setMessageText] = useState("");
	const { data: bot } = useQuery(
		orpc.bot.find.queryOptions({
			input: selectedBotId
				? {
						id: selectedBotId,
					}
				: skipToken,
		}),
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
	});
	const hasContent =
		messageText.trim().length > 0 ||
		localFiles.length > 0 ||
		selectedAttachments.length > 0;
	// The pickers lock while busy, as the pending send keeps its bot and model.
	const isBusy = isCreating || isUploading;

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmed = messageText.trim();
		if (!hasContent || isBusy || blocker) return;
		let attachments: ChatMessageAttachment[] | null;
		try {
			attachments = await resolveAttachmentsForSend();
		} catch (error) {
			toast.error(m.chat_composer_send_failed_toast_error(), {
				description: reasonMessageOf(error),
			});
			return;
		}
		if (!attachments) return;
		if (!trimmed && attachments.length === 0) {
			toast.error(m.chat_composer_attachments_missing_toast_error());
			return;
		}
		const sent = await onSend({
			text: trimmed || m.chat_composer_attachments_only_message(),
			attachments,
		});
		if (sent) {
			setMessageText("");
			clearAttachments();
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
			<form onSubmit={handleSubmit} className="flex flex-col gap-3">
				<input
					ref={fileInputRef}
					type="file"
					className="hidden"
					multiple
					accept={CHAT_ATTACHMENT_ACCEPT}
					onChange={handleFileInputChange}
				/>
				<InputGroup className="overflow-hidden border-border bg-card shadow-sm">
					<ChatComposerAttachments
						localFiles={localFiles}
						attachments={selectedAttachments}
						onRemoveLocalFile={removeLocalFile}
						onRemoveAsset={removeSelectedAsset}
					/>
					<InputGroupTextarea
						name="message"
						aria-label={m.chat_composer_aria_label()}
						placeholder={
							blocker
								? blockedPlaceholders[blocker.reason]()
								: m.chat_composer_placeholder()
						}
						className="field-sizing-content max-h-48 min-h-16"
						value={messageText}
						disabled={blocker !== undefined}
						aria-describedby={blocker ? "chat-model-notice" : undefined}
						onChange={(event) => setMessageText(event.target.value)}
						onKeyDown={handleTextareaKeyDown}
					/>

					<InputGroupAddon align="block-end" className="justify-between gap-1">
						<PromptInputTools>
							<ChatAttachmentActionMenu
								disabled={isBusy || !canAttachMore || blocker !== undefined}
								onUploadFile={openUploadDialog}
								onSelectFromAssets={() => setAssetPickerOpen(true)}
							/>
							{onBotSelect && (
								<BotSelectorButton
									selectedBotId={selectedBotId}
									onSelectBot={onBotSelect}
									variant="compact"
									disabled={isBusy}
								/>
							)}
							<ModelPicker
								state={modelPickerState({
									source:
										setup?.strength === "required" ? "bot-required" : "chat",
									modelId: selectedModelId ?? null,
									botSetup: setup ?? null,
								})}
								botName={bot?.data.name}
								selectedModelId={selectedModelId}
								selectedProviderId={selectedProviderId}
								onSelect={onModelSelect}
								disabled={isBusy}
							/>
						</PromptInputTools>
						<div className="flex shrink-0 items-center gap-1">
							<UsageIndicator
								providerId={selectedProviderId}
								modelId={selectedModelId}
							/>
							<PromptInputSubmit
								status={isBusy ? "submitted" : "ready"}
								disabled={
									isBusy ||
									blocker !== undefined ||
									!hasContent ||
									!selectedModelId
								}
							/>
						</div>
					</InputGroupAddon>
				</InputGroup>
				{blocker && <ChatModelNotice blocker={blocker} />}
			</form>
			<ChatAssetPicker
				open={assetPickerOpen}
				onOpenChange={setAssetPickerOpen}
				selectedAssetIds={selectedAssetIds}
				onAddAsset={addAsset}
				onRemoveAsset={removeSelectedAsset}
			/>
		</>
	);
};

export { NewChatInput };
