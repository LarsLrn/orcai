import type { UseChatHelpers } from "@ai-sdk/react";
import { CompassIcon, GlobeIcon, MicIcon } from "lucide-react";
import { useState } from "react";
import {
	PromptInput,
	PromptInputButton,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputToolbar,
	PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { ChatSettings } from "@/components/chat/chat-settings";
import { AppTourButton } from "@/components/next-step/app-tour-button";
import type { CustomUIMessage } from "@/lib/ai/tools";
import type { Chat } from "@/lib/orpc/schemas/chat";

const ChatInput = ({
	chatId,
	sendMessage,
	status,
}: {
	chatId: Chat["id"];
	sendMessage: UseChatHelpers<CustomUIMessage>["sendMessage"];
	status: UseChatHelpers<CustomUIMessage>["status"];
}) => {
	const [text, setText] = useState<string>("");

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		sendMessage({ text: text });
		setText("");
	};

	return (
		<PromptInput onSubmit={handleSubmit} className="mt-4 bg-card">
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
					<PromptInputButton asChild>
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
					</PromptInputButton>
					<PromptInputButton asChild>
						<ChatSettings chatId={chatId} className="text-muted-foreground" />
					</PromptInputButton>
				</PromptInputTools>
				<PromptInputSubmit disabled={!text} status={status} />
			</PromptInputToolbar>
		</PromptInput>
	);
};

export { ChatInput };
