import type { ChatId } from "@orcai/core";
import {
	CHAT_MESSAGE_ATTACHMENT_LIMIT,
	type Model,
	type Provider,
} from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import type { ChatStatus } from "ai";
import {
	CompassIcon,
	DownloadIcon,
	EllipsisIcon,
	SettingsIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { downloadConversation } from "@/components/ai-elements/conversation";
import {
	PromptInputSubmit,
	PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { AssistantModelLabel } from "@/components/assistant/assistant-model-label";
import { ChatAttachmentActionMenu } from "@/components/chat/attachments/chat-attachment-action-menu";
import { ChatComposerAttachments } from "@/components/chat/attachments/chat-attachment-input";
import { useChatAttachments } from "@/components/chat/attachments/use-chat-attachments";
import { ChatAssetPicker } from "@/components/chat/chat-asset-picker";
import type { ChatDraft } from "@/components/chat/chat-draft";
import { fetchWholeChat } from "@/components/chat/chat-history";
import { ChatSettings } from "@/components/chat/chat-settings";
import { ModelSelectorButton } from "@/components/chat/model-selector";
import { TourButton } from "@/components/tour/tour-button";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import { useUpdateChatMutation } from "@/hooks/mutations/use-chat-mutation";
import type { ChatSession } from "@/lib/ai/chat-session/chat-session";
import { transcriptMarkdown } from "@/lib/ai/turn-view/message-markdown";
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
	/** The assistant's model comes from the organisation, and it takes no attachments here. */
	variant?: "chat" | "assistant";
}) => {
	const isAssistant = variant === "assistant";
	const [messageText, setMessageText] = useState(draft?.text ?? "");
	const [settingsOpen, setSettingsOpen] = useState(false);

	const { data: chat } = useQuery(
		orpc.chat.find.queryOptions({
			input: {
				id: chatId,
				zedToken,
			},
		}),
	);
	const { mutate: updateChat } = useUpdateChatMutation();
	const isModelConfigured =
		isAssistant ||
		Boolean(chat?.data.config?.modelId && chat?.data.config?.providerId);
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

		if (isGenerating || isBusy) {
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

	const handleDownload = async () => {
		try {
			const messages = await fetchWholeChat({
				chatId,
				zedToken,
			});
			downloadConversation(transcriptMarkdown(messages));
		} catch (error) {
			toast.error(m.chat_download_failed_toast_error(), {
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
										<ModelSelectorButton
											selectedModelId={chat?.data.config?.modelId}
											selectedProviderId={chat?.data.config?.providerId}
											onSelect={handleModelSelect}
											className="max-w-32 sm:max-w-60"
										/>
									</>
								)}
								<DropdownMenu>
									<DropdownMenuTrigger
										render={
											<Button type="button" variant="ghost" size="icon-sm" />
										}
									>
										<EllipsisIcon />
										<span className="sr-only">
											{m.chat_composer_more_actions_aria_label()}
										</span>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start" className="w-56">
										{!isAssistant && (
											<>
												<TourButton
													tour="chatTour"
													type="button"
													variant="ghost"
													autoTrigger={true}
													render={<DropdownMenuItem />}
													className="w-full justify-start"
												>
													<CompassIcon className="size-4" />{" "}
													{m.chat_composer_start_tour_action()}
												</TourButton>
												<DropdownMenuItem onClick={() => setSettingsOpen(true)}>
													<SettingsIcon /> {m.chat_composer_settings_action()}
												</DropdownMenuItem>
											</>
										)}
										<DropdownMenuItem onClick={handleDownload}>
											<DownloadIcon /> {m.chat_composer_download_action()}
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</PromptInputTools>

							<PromptInputSubmit
								status={submitStatus}
								onStop={() => void stop()}
								disabled={
									isBusy ||
									(!isGenerating &&
										(!isModelConfigured ||
											!(
												messageText.trim().length > 0 ||
												localFiles.length > 0 ||
												selectedAttachments.length > 0
											)))
								}
							/>
						</InputGroupAddon>
					</InputGroup>
				</div>
				{!isModelConfigured && (
					<p className="mt-2 text-muted-foreground text-xs">
						{m.chat_composer_model_required_hint()}
					</p>
				)}
			</form>

			{!isAssistant && (
				<>
					<ChatAssetPicker
						open={assetPickerOpen}
						onOpenChange={setAssetPickerOpen}
						selectedAssetIds={selectedAssetIds}
						onAddAsset={addAsset}
						onRemoveAsset={removeSelectedAsset}
					/>
					<ChatSettings
						chatId={chatId}
						zedToken={zedToken}
						open={settingsOpen}
						onOpenChange={setSettingsOpen}
					/>
				</>
			)}
		</>
	);
};

export { ChatInput };
