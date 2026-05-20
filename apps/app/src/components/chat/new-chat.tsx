import type { BotId, ChatId } from "@orcai/core";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { ChatPlaceholder } from "@/components/chat/chat-placeholder";
import { NewChatInput } from "@/components/chat/new-chat-input";
import { useChatStarter } from "@/components/chat/use-chat-starter";

const NewChat = ({
	botId,
	onChatCreated,
}: {
	botId?: BotId;
	onChatCreated: (
		chatId: ChatId,
		pendingMessage: string,
		zedToken?: string,
	) => void;
}) => {
	const {
		selectedBotId,
		selectedModelId,
		selectedProviderId,
		isCreating,
		handleModelSelect,
		handleBotSelect,
		handleSend,
	} = useChatStarter({
		initialBotId: botId,
		onChatCreated,
	});

	return (
		<div className="flex size-full min-h-0 min-w-0 flex-col">
			<Conversation className="flex w-full" initial="instant">
				<ConversationContent className="mx-auto w-full max-w-200">
					<ChatPlaceholder />
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>

			<div className="mx-auto flex w-full flex-col gap-2 px-4 pt-2 pb-6 md:max-w-3xl md:pb-2">
				<NewChatInput
					selectedBotId={selectedBotId}
					selectedModelId={selectedModelId}
					selectedProviderId={selectedProviderId}
					onBotSelect={handleBotSelect}
					onModelSelect={handleModelSelect}
					onSend={handleSend}
					isCreating={isCreating}
				/>
			</div>
		</div>
	);
};

export { NewChat };
