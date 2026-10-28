import type { BotId, ModelId, ProviderId } from "@orcai/core";
import type { Model, Provider } from "@orcai/schema";
import { useState } from "react";
import {
	PromptInputSubmit,
	PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { BotSelectorButton } from "@/components/chat/bot-selector";
import { ChatModelNotice } from "@/components/chat/chat-model-notice";
import type { ComposerBlocker } from "@/components/chat/composer-blocker";
import { ModelSelectorButton } from "@/components/chat/model-selector";
import { UsageIndicator } from "@/components/chat/usage/usage-indicator";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import { m } from "@/paraglide/messages";

const blockedPlaceholders: Record<ComposerBlocker["reason"], () => string> = {
	model: m.chat_composer_placeholder_no_model,
	quota: m.chat_composer_placeholder_no_quota,
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
}: {
	selectedBotId?: BotId;
	selectedModelId?: ModelId;
	selectedProviderId?: ProviderId;
	onBotSelect?: (botId?: BotId) => void;
	onModelSelect: (model: Model, provider: Provider) => void;
	onSend: (text: string) => void;
	isCreating: boolean;
	blocker?: ComposerBlocker;
}) => {
	const [messageText, setMessageText] = useState("");

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
						<ModelSelectorButton
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
