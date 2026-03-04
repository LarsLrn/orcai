import type { UseChatHelpers } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatStatus } from "ai";
import { CompassIcon, GlobeIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConversationDownload } from "@/components/ai-elements/conversation";
import {
	PromptInputButton,
	PromptInputSubmit,
	PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { ChatAttachmentActionMenu } from "@/components/chat/attachments/chat-attachment-action-menu";
import { ChatComposerAttachments } from "@/components/chat/attachments/chat-attachment-input";
import { useChatAttachments } from "@/components/chat/attachments/use-chat-attachments";
import { ChatAssetPicker } from "@/components/chat/chat-asset-picker";
import { ChatSettings } from "@/components/chat/chat-settings";
import { AppTourButton } from "@/components/next-step/app-tour-button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { getChatMessageAttachments } from "@/lib/ai/types/chat-attachment";
import { orpc } from "@/lib/orpc/orpc";
import type { Chat } from "@/lib/orpc/schemas/chat";
import {
	CHAT_ATTACHMENT_ACCEPT,
	CHAT_ATTACHMENT_LIMIT,
} from "@/settings/constants";
import { ModelSelectorButton } from "./model-selector";

const ChatInput = ({
	chatId,
	sendMessage,
	messages,
	status,
	chatLength,
}: {
	chatId: Chat["id"];
	sendMessage: UseChatHelpers<ChatAgentUIMessage>["sendMessage"];
	messages: ChatAgentUIMessage[];
	status: UseChatHelpers<ChatAgentUIMessage>["status"];
	chatLength: number;
}) => {
	const queryClient = useQueryClient();
	const [messageText, setMessageText] = useState("");

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

		try {
			const attachments = await resolveAttachmentsForSend();

			if (!hasText && attachments.length === 0) {
				toast.error(
					"No attachments were available to send. Please retry your upload.",
				);
				return;
			}

			await sendMessage({
				text: hasText ? trimmedText : "Sent with attachments",
				metadata:
					attachments.length > 0
						? {
								attachments,
							}
						: undefined,
			});

			setMessageText("");
			clearAttachments();

			if (chatLength < 2) {
				await new Promise((resolve) => setTimeout(resolve, 5000));
				await queryClient.invalidateQueries({
					queryKey: orpc.chat.list.key({
						input: {
							pageIndex: 0,
							pageSize: 100,
						},
					}),
				});
			}
		} catch (error) {
			toast.error("Failed to send message with attachments.", {
				description:
					error instanceof Error ? error.message : "Unknown upload error.",
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
				<InputGroup className="overflow-hidden">
					<ChatComposerAttachments
						localFiles={localFiles}
						assets={selectedAssets}
						onRemoveLocalFile={removeLocalFile}
						onRemoveAsset={removeSelectedAsset}
					/>

					<InputGroupTextarea
						name="message"
						placeholder="What would you like to know?"
						className="field-sizing-content max-h-48 min-h-16"
						value={messageText}
						onChange={(event) => setMessageText(event.target.value)}
						onKeyDown={handleTextareaKeyDown}
					/>

					<InputGroupAddon align="block-end" className="justify-between gap-1">
						<PromptInputTools>
							<ChatAttachmentActionMenu
								disabled={!canAttachMore}
								onUploadFile={openUploadDialog}
								onSelectFromAssets={() => setAssetPickerOpen(true)}
							/>
							<PromptInputButton>
								<GlobeIcon size={16} />
								<span>Search</span>
							</PromptInputButton>
							<PromptInputButton
								render={
									<AppTourButton
										tour="chatTour"
										type="button"
										variant="ghost"
										size="icon"
										autoTrigger={true}
									>
										<CompassIcon className="size-4" />
										<span className="sr-only">Start tour</span>
									</AppTourButton>
								}
							/>
							<PromptInputButton
								render={
									<ChatSettings
										chatId={chatId}
										className="text-muted-foreground"
									/>
								}
							/>
							<ConversationDownload
								messages={messages.map((message) => ({
									role: message.role,
									content: [
										...message.parts
											.map((part) =>
												"text" in part ? part.text : "[file attachment]",
											)
											.filter(Boolean),
										...getChatMessageAttachments(message).map(
											(attachment) => `[attachment] ${attachment.title}`,
										),
									].join("\n"),
								}))}
							/>
						</PromptInputTools>

						<ModelSelectorButton />
						<PromptInputSubmit
							status={submitStatus}
							disabled={
								isGenerating ||
								isUploading ||
								!(
									messageText.trim().length > 0 ||
									localFiles.length > 0 ||
									selectedAssets.length > 0
								)
							}
						/>
					</InputGroupAddon>
				</InputGroup>
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

export { ChatInput };
