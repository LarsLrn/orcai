import type { BotId, ModelId, ProviderId } from "@orcai/core";
import type { Model, Provider } from "@orcai/schema";
import { useState } from "react";
import {
	PromptInputSubmit,
	PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { BotSelectorButton } from "@/components/chat/bot-selector";
import { ChatModelNotice } from "@/components/chat/chat-model-notice";
import { ModelSelectorButton } from "@/components/chat/model-selector";
import type { ChatAvailability } from "@/components/chat/use-chat-starter";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import { m } from "@/paraglide/messages";

const NewChatInput = ({
	selectedBotId,
	selectedModelId,
	selectedProviderId,
	onBotSelect,
	onModelSelect,
	onSend,
	isCreating,
	availability = "ready",
}: {
	selectedBotId?: BotId;
	selectedModelId?: ModelId;
	selectedProviderId?: ProviderId;
	onBotSelect?: (botId?: BotId) => void;
	onModelSelect: (model: Model, provider: Provider) => void;
	onSend: (text: string) => void;
	isCreating: boolean;
	availability?: ChatAvailability;
}) => {
	const [messageText, setMessageText] = useState("");
	const blocker =
		availability === "none"
			? "model"
			: availability === "no-quota"
				? "quota"
				: null;

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmed = messageText.trim();
		if (!trimmed || isCreating) return;
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
						blocker === "model"
							? m.chat_composer_placeholder_no_model()
							: blocker === "quota"
								? m.chat_composer_placeholder_no_quota()
								: m.chat_composer_placeholder()
					}
					className="field-sizing-content max-h-48 min-h-16"
					value={messageText}
					disabled={blocker !== null}
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
					<PromptInputSubmit
						status={isCreating ? "submitted" : "ready"}
						disabled={isCreating || !messageText.trim() || !selectedModelId}
					/>
				</InputGroupAddon>
			</InputGroup>
			{blocker && <ChatModelNotice reason={blocker} />}
		</form>
	);
};

export { NewChatInput };
