import type { BotId, ModelId, ProviderId } from "@orcai/core";
import type { BotSetup, Model, Provider } from "@orcai/schema";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
	PromptInputSubmit,
	PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { BotSelectorButton } from "@/components/chat/bot-selector";
import { ChatModelNotice } from "@/components/chat/chat-model-notice";
import type { ComposerBlocker } from "@/components/chat/composer-blocker";
import { ModelPicker } from "@/components/chat/model-picker";
import { modelPickerState } from "@/components/chat/model-picker-state";
import { UsageIndicator } from "@/components/chat/usage/usage-indicator";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const blockedPlaceholders: Record<ComposerBlocker["reason"], () => string> = {
	model: m.chat_composer_placeholder_no_model,
	quota: m.chat_composer_placeholder_no_quota,
	"bot-model": m.chat_composer_placeholder_bot_model,
	exhausted: m.chat_composer_placeholder_quota_exhausted,
};

const NewChatInput = ({
	selectedBotId,
	selectedModelId,
	selectedProviderId,
	onBotSelect,
	onModelSelect,
	onSend,
	isCreating,
	blocker,
	setup,
}: {
	selectedBotId?: BotId;
	selectedModelId?: ModelId;
	selectedProviderId?: ProviderId;
	onBotSelect?: (botId?: BotId) => void;
	onModelSelect: (model: Model, provider: Provider) => void;
	onSend: (text: string) => void;
	isCreating: boolean;
	blocker?: ComposerBlocker;
	/** The selected bot's setup, which fixes or recommends the model. */
	setup?: BotSetup | null;
}) => {
	const [messageText, setMessageText] = useState("");
	const { data: bot } = useQuery(
		orpc.bot.find.queryOptions({
			input: selectedBotId
				? {
						id: selectedBotId,
					}
				: skipToken,
		}),
	);

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmed = messageText.trim();
		if (!trimmed || isCreating || blocker) return;
		onSend(trimmed);
		setMessageText("");
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
		<form onSubmit={handleSubmit} className="flex flex-col gap-3">
			<InputGroup className="overflow-hidden border-border bg-card">
				<InputGroupTextarea
					name="message"
					aria-label={m.chat_composer_aria_label()}
					placeholder={
						blocker
							? blockedPlaceholders[blocker.reason]()
							: m.chat_composer_placeholder()
					}
					className="field-sizing-content max-h-48 min-h-16"
					value={messageText}
					disabled={blocker !== undefined}
					aria-describedby={blocker ? "chat-model-notice" : undefined}
					onChange={(event) => setMessageText(event.target.value)}
					onKeyDown={handleTextareaKeyDown}
				/>

				<InputGroupAddon align="block-end" className="justify-between gap-1">
					<PromptInputTools>
						{onBotSelect && (
							<BotSelectorButton
								selectedBotId={selectedBotId}
								onSelectBot={onBotSelect}
								variant="compact"
							/>
						)}
						<ModelPicker
							state={modelPickerState({
								source:
									setup?.strength === "required" ? "bot-required" : "chat",
								modelId: selectedModelId ?? null,
								botSetup: setup ?? null,
							})}
							botName={bot?.data.name}
							selectedModelId={selectedModelId}
							selectedProviderId={selectedProviderId}
							onSelect={onModelSelect}
						/>
					</PromptInputTools>
					<div className="flex shrink-0 items-center gap-1">
						<UsageIndicator
							providerId={selectedProviderId}
							modelId={selectedModelId}
						/>
						<PromptInputSubmit
							status={isCreating ? "submitted" : "ready"}
							disabled={
								isCreating ||
								blocker !== undefined ||
								!messageText.trim() ||
								!selectedModelId
							}
						/>
					</div>
				</InputGroupAddon>
			</InputGroup>
			{blocker && <ChatModelNotice blocker={blocker} />}
		</form>
	);
};

export { NewChatInput };
