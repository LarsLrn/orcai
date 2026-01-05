import type { UseChatHelpers } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { CompassIcon, GlobeIcon, MicIcon } from "lucide-react";
import { useState } from "react";
import {
	PromptInput,
	PromptInputButton,
	type PromptInputMessage,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputToolbar,
	PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { ChatSettings } from "@/components/chat/chat-settings";
import { AppTourButton } from "@/components/next-step/app-tour-button";
import type { CustomUIMessage } from "@/lib/ai/tools";
import { orpc } from "@/lib/orpc/orpc";
import type { Chat } from "@/lib/orpc/schemas/chat";

const ChatInput = ({
	chatId,
	sendMessage,
	status,
	chatLength,
}: {
	chatId: Chat["id"];
	sendMessage: UseChatHelpers<CustomUIMessage>["sendMessage"];
	status: UseChatHelpers<CustomUIMessage>["status"];
	chatLength: number;
}) => {
	const [text, setText] = useState<string>("");
	const queryClient = useQueryClient();

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
		setText("");

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
		<PromptInput onSubmit={handleSubmit} className="rounded-md bg-card">
			<PromptInputTextarea
				onChange={(e) => setText(e.target.value)}
				value={text}
			/>
			<PromptInputToolbar className="border-t">
				<PromptInputTools>
					<PromptInputButton>
						<MicIcon size={16} />
					</PromptInputButton>
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
							<ChatSettings chatId={chatId} className="text-muted-foreground" />
						}
					/>
				</PromptInputTools>
				<PromptInputSubmit disabled={!text} status={status} />
			</PromptInputToolbar>
		</PromptInput>
	);
};

export { ChatInput };
