import type { Model } from "@orcai/schema";
import { useState } from "react";
import {
	PromptInputSubmit,
	PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { BotSelectorButton } from "@/components/chat/bot-selector";
import { ModelSelectorButton } from "@/components/chat/model-selector";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import type { Bot } from "@/lib/orpc/schemas/bot";
import type { Provider } from "@/lib/orpc/schemas/provider";

const NewChatInput = ({
	selectedBotId,
	selectedModelId,
	selectedProviderId,
	onBotSelect,
	onModelSelect,
	onSend,
	isCreating,
}: {
	selectedBotId?: Bot["id"];
	selectedModelId?: string;
	selectedProviderId?: string;
	onBotSelect?: (botId?: Bot["id"]) => void;
	onModelSelect: (model: Model, provider: Provider) => void;
	onSend: (text: string) => void;
	isCreating: boolean;
}) => {
	const [messageText, setMessageText] = useState("");

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmed = messageText.trim();
		if (!trimmed || isCreating) return;
		onSend(trimmed);
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
		<form onSubmit={handleSubmit}>
			<InputGroup className="overflow-hidden border-border bg-card">
				<InputGroupTextarea
					name="message"
					placeholder="What would you like to know?"
					className="field-sizing-content max-h-48 min-h-16"
					value={messageText}
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
		</form>
	);
};

export { NewChatInput };
