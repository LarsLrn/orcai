import type { BotId, ChatId } from "@orcai/core";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { AssetsPanel } from "@/components/assets/readiness/assets-panel";
import { useChatRepositoryIds } from "@/components/assets/readiness/use-repository-readiness";
import type { ChatDraft } from "@/components/chat/chat-draft";
import { ChatPlaceholder } from "@/components/chat/chat-placeholder";
import { NewChatInput } from "@/components/chat/new-chat-input";
import { useChatStarter } from "@/components/chat/use-chat-starter";
import { WebSearchNotice } from "@/components/chat/web-search-notice";
import { MessageScrollerItem } from "@/components/ui/message-scroller";

const NewChat = ({
	botId,
	onChatCreated,
}: {
	botId?: BotId;
	onChatCreated: (
		chatId: ChatId,
		pendingMessage: ChatDraft,
		zedToken?: string,
	) => void;
}) => {
	const {
		selectedBotId,
		selectedModelId,
		selectedProviderId,
		blocker,
		setup,
		isCreating,
		handleModelSelect,
		handleBotSelect,
		handleSend,
	} = useChatStarter({
		initialBotId: botId,
		onChatCreated,
	});
	const repositoryIds = useChatRepositoryIds({
		botId: selectedBotId,
	});

	return (
		<div className="flex size-full min-h-0 min-w-0 flex-col">
			<Conversation>
				<ConversationContent className="mx-auto w-full max-w-200">
					<MessageScrollerItem className="flex flex-1 flex-col justify-center">
						<ChatPlaceholder botId={selectedBotId} />
					</MessageScrollerItem>
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>

			<div className="mx-auto flex w-full flex-col gap-2 px-4 pt-2 pb-6 md:max-w-3xl md:pb-2">
				<WebSearchNotice
					botId={selectedBotId}
					providerId={selectedProviderId}
				/>
				<AssetsPanel blockIds={repositoryIds} />
				<NewChatInput
					selectedBotId={selectedBotId}
					selectedModelId={selectedModelId}
					selectedProviderId={selectedProviderId}
					onBotSelect={handleBotSelect}
					onModelSelect={handleModelSelect}
					onSend={handleSend}
					isCreating={isCreating}
					blocker={blocker}
					setup={setup}
				/>
			</div>
		</div>
	);
};

export { NewChat };
