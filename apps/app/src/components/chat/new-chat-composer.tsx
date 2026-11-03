import { skipToken, useQuery } from "@tanstack/react-query";
import { BotSelectorButton } from "@/components/chat/bot-selector";
import { Composer } from "@/components/chat/composer";
import { ModelPicker } from "@/components/chat/model-picker";
import { modelPickerState } from "@/components/chat/model-picker-state";
import type { useChatStarter } from "@/components/chat/use-chat-starter";
import { orpc } from "@/lib/orpc/orpc";

/** The composer of a chat yet to be created, with its bot and model pickers. */
const NewChatComposer = ({
	starter: {
		selectedBotId,
		selectedModelId,
		selectedProviderId,
		setup,
		blocker,
		isStarting,
		handleModelSelect,
		handleBotSelect,
		handleSend,
	},
}: {
	starter: ReturnType<typeof useChatStarter>;
}) => {
	const { data: bot } = useQuery(
		orpc.bot.find.queryOptions({
			input: selectedBotId
				? {
						id: selectedBotId,
					}
				: skipToken,
		}),
	);

	return (
		<Composer
			onSend={handleSend}
			model={{
				modelId: selectedModelId,
				providerId: selectedProviderId,
			}}
			blocker={blocker}
			busy={isStarting}
			// The pickers lock while a send is pending, as it keeps its bot and model.
			tools={(held) => (
				<>
					<BotSelectorButton
						selectedBotId={selectedBotId}
						onSelectBot={handleBotSelect}
						variant="compact"
						disabled={held}
					/>
					<ModelPicker
						state={modelPickerState({
							source: setup?.strength === "required" ? "bot-required" : "chat",
							modelId: selectedModelId ?? null,
							botSetup: setup,
						})}
						botName={bot?.data.name}
						selectedModelId={selectedModelId}
						selectedProviderId={selectedProviderId}
						onSelect={handleModelSelect}
						disabled={held}
					/>
				</>
			)}
		/>
	);
};

export { NewChatComposer };
