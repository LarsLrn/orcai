import type { UseChatHelpers } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { CompassIcon, GlobeIcon } from "lucide-react";
import { useRef } from "react";
import {
	PromptInput,
	PromptInputActionAddAttachments,
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuTrigger,
	PromptInputBody,
	PromptInputButton,
	PromptInputFooter,
	PromptInputHeader,
	type PromptInputMessage,
	PromptInputProvider,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
	usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { ChatSettings } from "@/components/chat/chat-settings";
import { AppTourButton } from "@/components/next-step/app-tour-button";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { orpc } from "@/lib/orpc/orpc";
import type { Chat } from "@/lib/orpc/schemas/chat";
import {
	Attachment,
	AttachmentPreview,
	AttachmentRemove,
	Attachments,
} from "../ai-elements/attachments";
import { ModelSelectorButton } from "./model-selector";

const ChatInput = ({
	chatId,
	sendMessage,
	status,
	chatLength,
}: {
	chatId: Chat["id"];
	sendMessage: UseChatHelpers<ChatAgentUIMessage>["sendMessage"];
	status: UseChatHelpers<ChatAgentUIMessage>["status"];
	chatLength: number;
}) => {
	const queryClient = useQueryClient();
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleSubmit = async (message: PromptInputMessage) => {
		const hasText = Boolean(message.text);
		const hasAttachments = Boolean(message.files?.length);

		if (!(hasText || hasAttachments)) {
			return;
		}

		sendMessage({
			text: message.text || "Sent with attachments",
			files: message.files,
		});

		if (chatLength < 2) {
			// TODO: Ultimately this would be rolled into chat creation, where new chats are only created on the first user message.
			await new Promise((resolve) => setTimeout(resolve, 5000));

			await queryClient.invalidateQueries({
				queryKey: orpc.chat.list.key({
					input: { pageIndex: 0, pageSize: 100 },
				}),
			});
		}
	};

	return (
		<PromptInputProvider>
			<PromptInput globalDrop multiple onSubmit={handleSubmit}>
				<PromptInputHeader>
					<PromptInputAttachmentsDisplay />
				</PromptInputHeader>
				<PromptInputBody>
					<PromptInputTextarea ref={textareaRef} />
				</PromptInputBody>
				<PromptInputFooter>
					<PromptInputTools>
						<PromptInputActionMenu>
							<PromptInputActionMenuTrigger />
							<PromptInputActionMenuContent>
								<PromptInputActionAddAttachments />
							</PromptInputActionMenuContent>
						</PromptInputActionMenu>
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
					</PromptInputTools>
					{/* // TODO: Implement functionality for model selection */}
					<ModelSelectorButton />
					<PromptInputSubmit status={status} />
				</PromptInputFooter>
			</PromptInput>
		</PromptInputProvider>
	);
};

const PromptInputAttachmentsDisplay = () => {
	const attachments = usePromptInputAttachments();

	if (attachments.files.length === 0) {
		return null;
	}

	return (
		<Attachments variant="inline">
			{attachments.files.map((attachment) => (
				<Attachment
					data={attachment}
					key={attachment.id}
					onRemove={() => attachments.remove(attachment.id)}
				>
					<AttachmentPreview />
					<AttachmentRemove />
				</Attachment>
			))}
		</Attachments>
	);
};

export { ChatInput };
