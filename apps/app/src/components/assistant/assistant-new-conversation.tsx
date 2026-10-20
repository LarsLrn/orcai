import type { ChatId } from "@orcai/core";
import { useState } from "react";
import { PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { AssistantModelLabel } from "@/components/assistant/assistant-model-label";
import { AssistantPlaceholder } from "@/components/assistant/assistant-placeholder";
import { AssistantUnavailable } from "@/components/assistant/assistant-unavailable";
import { useAssistantStarter } from "@/components/assistant/use-assistant-starter";
import { ChatModelNotice } from "@/components/chat/chat-model-notice";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { m } from "@/paraglide/messages";

const AssistantNewConversation = ({
	initialText,
	onConversationCreated,
}: {
	initialText?: string;
	onConversationCreated: (
		chatId: ChatId,
		pendingMessage: string,
		zedToken?: string,
	) => void | Promise<void>;
}) => {
	const [messageText, setMessageText] = useState(initialText ?? "");
	const { availability, isCreating, handleSend } = useAssistantStarter({
		onConversationCreated,
	});
	const isBlocked = availability === "no-quota";

	if (availability === "loading") {
		return <Spinner className="mx-auto my-8" />;
	}

	if (availability === "unset") {
		return <AssistantUnavailable />;
	}

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmed = messageText.trim();
		if (!trimmed || isCreating || isBlocked) return;
		void handleSend(trimmed).then((created) => {
			if (created) setMessageText("");
		});
	};

	const handleTextareaKeyDown = (
		event: React.KeyboardEvent<HTMLTextAreaElement>,
	) => {
		// Enter also confirms an IME composition, which must not send.
		if (
			event.key === "Enter" &&
			!event.shiftKey &&
			!event.nativeEvent.isComposing
		) {
			event.preventDefault();
			event.currentTarget.form?.requestSubmit();
		}
	};

	return (
		<div className="flex flex-col gap-6">
			<AssistantPlaceholder />
			<form onSubmit={handleSubmit} className="flex flex-col gap-3">
				<InputGroup className="overflow-hidden border-border bg-card">
					<InputGroupTextarea
						name="message"
						aria-label={m.chat_composer_aria_label()}
						placeholder={
							isBlocked
								? m.chat_composer_placeholder_no_quota()
								: m.chat_composer_placeholder()
						}
						className="field-sizing-content max-h-48 min-h-16"
						value={messageText}
						disabled={isBlocked}
						aria-describedby={isBlocked ? "chat-model-notice" : undefined}
						onChange={(event) => setMessageText(event.target.value)}
						onKeyDown={handleTextareaKeyDown}
					/>
					<InputGroupAddon
						align="block-end"
						className="min-w-0 justify-between gap-1"
					>
						<AssistantModelLabel />
						<PromptInputSubmit
							status={isCreating ? "submitted" : "ready"}
							disabled={isCreating || isBlocked || !messageText.trim()}
						/>
					</InputGroupAddon>
				</InputGroup>
				{isBlocked && <ChatModelNotice reason="quota" />}
			</form>
		</div>
	);
};

export { AssistantNewConversation };
