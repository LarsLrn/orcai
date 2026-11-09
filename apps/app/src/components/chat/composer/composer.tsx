import {
	CHAT_MESSAGE_ATTACHMENT_LIMIT,
	type ChatMessageAttachment,
} from "@orcai/schema";
import type { ChatStatus } from "ai";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	PromptInputSubmit,
	PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { ChatAttachmentActionMenu } from "@/components/chat/composer/attachments/chat-attachment-action-menu";
import {
	ChatComposerAttachments,
	ChatComposerDropZone,
} from "@/components/chat/composer/attachments/chat-attachment-input";
import { useChatAttachments } from "@/components/chat/composer/attachments/use-chat-attachments";
import { ChatAssetPicker } from "@/components/chat/composer/chat-asset-picker";
import type { ChatDraft } from "@/components/chat/composer/chat-draft";
import { ChatModelNotice } from "@/components/chat/composer/chat-model-notice";
import type { ComposerBlocker } from "@/components/chat/composer/composer-blocker";
import type { SelectedModel } from "@/components/chat/composer/use-composer-send-state";
import { UsageIndicator } from "@/components/chat/usage/usage-indicator";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import type { ChatPhase } from "@/lib/ai/messages/turn-view";
import { reasonMessageOf } from "@/lib/errors/describe-error";
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

const blockedPlaceholders: Record<ComposerBlocker["reason"], () => string> = {
	model: m.chat_composer_placeholder_no_model,
	quota: m.chat_composer_placeholder_no_quota,
	"bot-model": m.chat_composer_placeholder_bot_model,
	exhausted: m.chat_composer_placeholder_quota_exhausted,
};

// The Assistant's model is the admins' choice, so only its pool can block it.
const assistantBlockedPlaceholders: Record<
	ComposerBlocker["reason"],
	() => string
> = {
	model: m.assistant_composer_placeholder_no_quota,
	quota: m.assistant_composer_placeholder_no_quota,
	"bot-model": m.assistant_composer_placeholder_no_quota,
	exhausted: m.assistant_composer_placeholder_quota_exhausted,
};

/**
 * Writes a message and hands it to `onSend`. The message leaves the composer
 * on hand-off and comes back, attachments too, if it never reached the
 * transcript and the composer is still empty. A blocker stops sending only,
 * so a running turn keeps its Stop.
 */
const Composer = ({
	draft,
	onSend,
	withAttachments = true,
	assistant = false,
	model,
	blocker,
	busy = false,
	turn,
	contextTokens,
	tools,
	children,
}: {
	/** Prefills the composer, e.g. with the message a branch started from. */
	draft?: ChatDraft;
	/** Resolves whether the message reached the transcript; a rejection toasts as a failed send. */
	onSend: (draft: ChatDraft) => Promise<boolean>;
	withAttachments?: boolean;
	/** Words the blocked state for the Assistant. */
	assistant?: boolean;
	/** The model the message goes to, unset until known. */
	model: SelectedModel;
	blocker?: ComposerBlocker;
	/** Something other than a turn holds the composer, such as a chat being created. */
	busy?: boolean;
	/** The open chat's turn, which the submit button stops while it runs. */
	turn?: {
		/** While `storing`, a stopped or failed reply is still being saved, so the next message waits. */
		phase: ChatPhase;
		stop: () => Promise<void>;
	};
	/** What the newest reply's context held. */
	contextTokens?: number;
	/** Controls beside the attachment menu, given whether a pending send holds them. */
	tools: (held: boolean) => ReactNode;
	children?: ReactNode;
}) => {
	const [messageText, setMessageText] = useState(draft?.text ?? "");
	// What the composer holds now, read when a send that never reached the transcript ends.
	const holds = useRef(false);
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
		addFiles,
		addAsset,
		removeLocalFile,
		removeSelectedAsset,
		clearAttachments,
		restoreAttachments,
		resolveAttachmentsForSend,
	} = useChatAttachments({
		limit: CHAT_MESSAGE_ATTACHMENT_LIMIT,
		initialAttachments: draft?.attachments,
	});

	const phase = turn?.phase ?? "idle";
	const isGenerating = phase === "sending" || phase === "streaming";
	const isHeld = busy || isUploading || phase === "storing";
	const isModelConfigured = Boolean(model.modelId && model.providerId);
	const hasContent =
		messageText.trim().length > 0 ||
		localFiles.length > 0 ||
		selectedAttachments.length > 0;
	useEffect(() => {
		holds.current =
			messageText.length > 0 ||
			localFiles.length > 0 ||
			selectedAttachments.length > 0;
	});

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const text = messageText.trim();
		if (!hasContent || isGenerating || isHeld || blocker) return;
		if (!isModelConfigured) {
			toast.error(m.chat_composer_model_required_toast_error());
			return;
		}

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
		if (!text && attachments.length === 0) {
			toast.error(m.chat_composer_attachments_missing_toast_error());
			return;
		}

		setMessageText("");
		clearAttachments();
		const reached = await onSend({
			text: text || m.chat_composer_attachments_only_message(),
			attachments,
		}).catch((error: unknown) => {
			toast.error(m.chat_composer_send_failed_toast_error(), {
				description: reasonMessageOf(error),
			});
			return false;
		});
		if (!reached && !holds.current) {
			setMessageText(text);
			restoreAttachments(attachments);
		}
	};

	const handleTextareaKeyDown = (
		event: React.KeyboardEvent<HTMLTextAreaElement>,
	) => {
		// Enter also confirms an IME composition, which must not send; Safari reports that keydown after the composition ended, as key code 229.
		if (
			event.key === "Enter" &&
			!event.shiftKey &&
			!event.nativeEvent.isComposing &&
			event.nativeEvent.keyCode !== 229
		) {
			event.preventDefault();
			event.currentTarget.form?.requestSubmit();
		}
	};

	return (
		<>
			<form onSubmit={handleSubmit} className="flex flex-col gap-3">
				{withAttachments && (
					<input
						ref={fileInputRef}
						type="file"
						className="hidden"
						multiple
						accept={CHAT_ATTACHMENT_ACCEPT}
						onChange={handleFileInputChange}
					/>
				)}
				{/* The group clips its overflow, so the comet sits on a wrapper hugging its corners. */}
				<ChatComposerDropZone
					onFiles={addFiles}
					disabled={!withAttachments || isHeld}
					className={cn(
						"[--loading-ring-radius:calc(var(--radius-3xl)+6px)]",
						(isGenerating || phase === "storing") && "loading-ring",
					)}
				>
					<InputGroup className="border-border bg-card overflow-hidden shadow-sm">
						{withAttachments && (
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
							placeholder={
								blocker
									? (assistant
											? assistantBlockedPlaceholders
											: blockedPlaceholders)[blocker.reason]()
									: m.chat_composer_placeholder()
							}
							className="field-sizing-content max-h-48 min-h-16"
							value={messageText}
							aria-describedby={blocker ? "chat-model-notice" : undefined}
							onChange={(event) => setMessageText(event.target.value)}
							onKeyDown={handleTextareaKeyDown}
						/>
						<InputGroupAddon
							align="block-end"
							className="min-w-0 justify-between gap-1"
						>
							<PromptInputTools>
								{withAttachments && (
									<ChatAttachmentActionMenu
										disabled={isHeld || !canAttachMore}
										onUploadFile={openUploadDialog}
										onSelectFromAssets={() => setAssetPickerOpen(true)}
									/>
								)}
								{tools(isHeld)}
							</PromptInputTools>
							<div className="flex shrink-0 items-center gap-1">
								<UsageIndicator
									providerId={model.providerId}
									modelId={model.modelId}
									contextTokens={contextTokens}
								/>
								<PromptInputSubmit
									status={isHeld ? "submitted" : submitStatuses[phase]}
									onStop={turn && (() => void turn.stop())}
									disabled={
										isHeld ||
										(!isGenerating &&
											(!isModelConfigured ||
												blocker !== undefined ||
												!hasContent))
									}
								/>
							</div>
						</InputGroupAddon>
					</InputGroup>
				</ChatComposerDropZone>
				{children}
				{blocker && <ChatModelNotice blocker={blocker} assistant={assistant} />}
			</form>
			{withAttachments && (
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

export { Composer };
