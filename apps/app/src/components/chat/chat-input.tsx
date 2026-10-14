import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatId } from "@orcai/core";
import type { Model, Provider } from "@orcai/schema";
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
import { ConversationDownload } from "@/components/ai-elements/conversation";
import {
	PromptInputSubmit,
	PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { ChatAttachmentActionMenu } from "@/components/chat/attachments/chat-attachment-action-menu";
import { ChatComposerAttachments } from "@/components/chat/attachments/chat-attachment-input";
import { useChatAttachments } from "@/components/chat/attachments/use-chat-attachments";
import { ChatAssetPicker } from "@/components/chat/chat-asset-picker";
import { ChatSettings } from "@/components/chat/chat-settings";
import { ModelSelectorButton } from "@/components/chat/model-selector";
import { AppTourButton } from "@/components/next-step/app-tour-button";
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
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";
import {
	CHAT_ATTACHMENT_ACCEPT,
	CHAT_ATTACHMENT_LIMIT,
} from "@/settings/constants";

const ChatInput = ({
	chatId,
	zedToken,
	sendMessage,
	stop,
	messages,
	status,
}: {
	chatId: ChatId;
	zedToken?: string;
	sendMessage: UseChatHelpers<ChatAgentUIMessage>["sendMessage"];
	stop: UseChatHelpers<ChatAgentUIMessage>["stop"];
	messages: ChatAgentUIMessage[];
	status: UseChatHelpers<ChatAgentUIMessage>["status"];
}) => {
	const [messageText, setMessageText] = useState("");
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
	const isModelConfigured = Boolean(
		chat?.data.config?.modelId && chat?.data.config?.providerId,
	);
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
		selectedAssets,
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
		limit: CHAT_ATTACHMENT_LIMIT,
	});

	const isGenerating = status === "submitted" || status === "streaming";
	const submitStatus: ChatStatus = isUploading ? "submitted" : status;

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const trimmedText = messageText.trim();
		const hasText = trimmedText.length > 0;
		const hasLocalFiles = localFiles.length > 0;
		const hasSelectedAssets = selectedAssets.length > 0;

		if (!(hasText || hasLocalFiles || hasSelectedAssets)) {
			return;
		}

		if (isGenerating || isUploading) {
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

			const sendPromise = sendMessage({
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
			<input
				ref={fileInputRef}
				type="file"
				className="hidden"
				multiple
				accept={CHAT_ATTACHMENT_ACCEPT}
				onChange={handleFileInputChange}
			/>

			<form onSubmit={handleSubmit}>
				<InputGroup className="overflow-hidden border-border bg-card">
					<ChatComposerAttachments
						localFiles={localFiles}
						assets={selectedAssets}
						onRemoveLocalFile={removeLocalFile}
						onRemoveAsset={removeSelectedAsset}
					/>

					<InputGroupTextarea
						name="message"
						placeholder={m.chat_composer_placeholder()}
						className="field-sizing-content max-h-48 min-h-16"
						value={messageText}
						onChange={(event) => setMessageText(event.target.value)}
						onKeyDown={handleTextareaKeyDown}
					/>

					<InputGroupAddon
						align="block-end"
						className="min-w-0 justify-between gap-1"
					>
						<PromptInputTools className="min-w-0 overflow-hidden">
							<ChatAttachmentActionMenu
								disabled={!canAttachMore}
								onUploadFile={openUploadDialog}
								onSelectFromAssets={() => setAssetPickerOpen(true)}
							/>
							<ModelSelectorButton
								selectedModelId={chat?.data.config?.modelId}
								selectedProviderId={chat?.data.config?.providerId}
								onSelect={handleModelSelect}
								className="min-w-0 max-w-32 sm:max-w-60"
							/>
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
									<AppTourButton
										tour="chatTour"
										type="button"
										variant="ghost"
										autoTrigger={true}
										render={<DropdownMenuItem />}
										className="w-full justify-start"
									>
										<CompassIcon className="size-4" />{" "}
										{m.chat_composer_start_tour_action()}
									</AppTourButton>
									<DropdownMenuItem onClick={() => setSettingsOpen(true)}>
										<SettingsIcon /> {m.chat_composer_settings_action()}
									</DropdownMenuItem>
									<ConversationDownload
										messages={messages}
										render={<DropdownMenuItem />}
										variant="ghost"
										className="w-full justify-start"
									>
										<DownloadIcon className="size-4" />{" "}
										{m.chat_composer_download_action()}
									</ConversationDownload>
								</DropdownMenuContent>
							</DropdownMenu>
						</PromptInputTools>

						<PromptInputSubmit
							status={submitStatus}
							onStop={stop}
							disabled={
								isUploading ||
								(!isGenerating &&
									(!isModelConfigured ||
										!(
											messageText.trim().length > 0 ||
											localFiles.length > 0 ||
											selectedAssets.length > 0
										)))
							}
						/>
					</InputGroupAddon>
				</InputGroup>
				{!isModelConfigured && (
					<p className="mt-2 text-muted-foreground text-xs">
						{m.chat_composer_model_required_hint()}
					</p>
				)}
			</form>

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
	);
};

export { ChatInput };
