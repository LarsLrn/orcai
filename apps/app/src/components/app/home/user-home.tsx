import { useNavigate } from "@tanstack/react-router";
import { UserWelcome } from "@/components/app/user-welcome";
import { NewChatInput } from "@/components/chat/new-chat-input";
import { useChatStarter } from "@/components/chat/use-chat-starter";
import { ActivityCard } from "./activity-card";
import { OrganizationCard } from "./organization-card";
import { RecentChats } from "./recent-chats";
import { TrySomething } from "./try-something";

const QuickChat = () => {
	const navigate = useNavigate();
	const {
		selectedBotId,
		selectedModelId,
		selectedProviderId,
		blocker,
		isCreating,
		handleModelSelect,
		handleBotSelect,
		handleSend,
	} = useChatStarter({
		onChatCreated: (chatId, pendingMessage, zedToken) =>
			navigate({
				to: "/app/chat/$chatId",
				params: {
					chatId,
				},
				search: {
					zedToken,
				},
				state: (previous) => ({
					...previous,
					pendingMessage,
				}),
			}),
	});

	return (
		<NewChatInput
			selectedBotId={selectedBotId}
			selectedModelId={selectedModelId}
			selectedProviderId={selectedProviderId}
			onBotSelect={handleBotSelect}
			onModelSelect={handleModelSelect}
			onSend={handleSend}
			isCreating={isCreating}
			blocker={blocker}
		/>
	);
};

/**
 * The Use view: greeting and composer, the active organisation and running
 * work beside them from lg (above the rest below lg), then bots to try and
 * recent chats.
 */
const UserHome = () => (
	<div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
		<div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
			<UserWelcome />
			<QuickChat />
		</div>
		<div className="space-y-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
			<OrganizationCard />
			<ActivityCard />
		</div>
		<div className="min-w-0 space-y-10 lg:col-start-1 lg:row-start-2">
			<TrySomething />
			<RecentChats />
		</div>
	</div>
);

export { UserHome };
