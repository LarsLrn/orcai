import type { BotId, ChatId } from "@orcai/core";
import type { EffectiveModel } from "@orcai/schema";
import { skipToken, useQuery } from "@tanstack/react-query";
import { ModelPicker } from "@/components/chat/model-picker";
import { modelPickerState } from "@/components/chat/model-picker-state";
import { useUpdateChatMutation } from "@/hooks/mutations/use-chat-mutation";
import { orpc } from "@/lib/orpc/orpc";

/** An open chat's model picker, which saves the pick to the chat. */
const ChatModelPicker = ({
	chatId,
	botId,
	effectiveModel,
	disabled,
}: {
	chatId: ChatId;
	botId: BotId | null | undefined;
	/** Unknown until the chat loads. */
	effectiveModel: EffectiveModel | undefined;
	/** Locked while a send is held, as the turn reads the saved model. */
	disabled: boolean;
}) => {
	const { data: bot } = useQuery(
		orpc.bot.find.queryOptions({
			input: botId
				? {
						id: botId,
					}
				: skipToken,
		}),
	);
	const { mutate: updateChat } = useUpdateChatMutation();

	return (
		<ModelPicker
			state={
				effectiveModel
					? modelPickerState(effectiveModel)
					: {
							kind: "free",
						}
			}
			botName={bot?.data.name}
			selectedModelId={effectiveModel?.modelId ?? undefined}
			selectedProviderId={effectiveModel?.providerId ?? undefined}
			onSelect={(model, provider) =>
				updateChat({
					id: chatId,
					config: {
						modelId: model.id,
						providerId: provider.id,
					},
				})
			}
			disabled={disabled}
			className="max-w-32 sm:max-w-60"
		/>
	);
};

export { ChatModelPicker };
