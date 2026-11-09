import type { BotId } from "@orcai/core";
import {
	Conversation,
	ConversationContent,
} from "@/components/ai-elements/conversation";
import { AssetsPanel } from "@/components/assets/readiness/assets-panel";
import { useChatRepositoryIds } from "@/components/assets/readiness/use-repository-readiness";
import { ChatPlaceholder } from "@/components/chat/chat-placeholder";
import { NewChatComposer } from "@/components/chat/composer/new-chat-composer";
import { useChatStarter } from "@/components/chat/composer/use-chat-starter";
import { WebSearchNotice } from "@/components/chat/web-search-notice";
import { ChatEmbeddingsRebuildNotice } from "@/components/instance/settings/embeddings-rebuild-notice";
import {
	MessageScrollerButton,
	MessageScrollerItem,
} from "@/components/ui/message-scroller";

const NewChat = ({ botId }: { botId?: BotId }) => {
	const starter = useChatStarter({
		initialBotId: botId,
	});
	const { selectedBotId, selectedProviderId } = starter;
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
				<MessageScrollerButton />
			</Conversation>

			<div className="mx-auto flex w-full flex-col gap-2 px-4 pt-2 pb-6 md:max-w-3xl md:pb-2">
				<WebSearchNotice
					botId={selectedBotId}
					providerId={selectedProviderId}
				/>
				<ChatEmbeddingsRebuildNotice repositoryIds={repositoryIds} />
				<AssetsPanel blockIds={repositoryIds} />
				<NewChatComposer starter={starter} />
			</div>
		</div>
	);
};

export { NewChat };
