import type { UseChatHelpers } from "@ai-sdk/react";
import { CompassIcon, RefreshCcwIcon } from "lucide-react";
import { AppTourButton } from "@/components/next-step/app-tour-button";
import { Button } from "@/components/ui/button";
import type { CustomUIMessage } from "@/lib/ai/tools";
import { SendButton, StopButton } from "./chat-buttons";

interface ChatInputActionsProps {
	status?: UseChatHelpers<CustomUIMessage>["status"];
	input: string;
	submitForm: () => void;
	stop: () => void;
	setMessages: UseChatHelpers<CustomUIMessage>["setMessages"];
}

export const ChatInputActions = ({
	status,
	input,
	submitForm,
	stop,
	setMessages,
}: ChatInputActionsProps) => {
	const isStreaming = status === "streaming" || status === "submitted";

	return (
		<>
			{isStreaming ? (
				<StopButton stop={stop} setMessages={setMessages} />
			) : (
				<SendButton input={input} submitForm={submitForm} />
			)}
		</>
	);
};

interface ChatInputUtilityActionsProps {
	hasMessages: boolean;
	handleReload: () => void;
}

export const ChatInputUtilityActions = ({
	hasMessages,
	handleReload,
}: ChatInputUtilityActionsProps) => {
	if (!hasMessages) {
		return (
			<AppTourButton
				tour="chatTour"
				type="button"
				variant="ghost"
				size="icon"
				className="size-7 text-muted-foreground"
				autoTrigger={true}
			>
				<CompassIcon className="size-4" />
				<span className="sr-only">Start tour</span>
			</AppTourButton>
		);
	}

	return (
		<div className="flex gap-1">
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-7"
				onClick={handleReload}
			>
				<RefreshCcwIcon className="size-4" />
				<span className="sr-only">Regenerate last message</span>
			</Button>

			<AppTourButton
				tour="chatTour"
				type="button"
				variant="ghost"
				size="icon"
				className="size-7 text-muted-foreground"
				autoTrigger={true}
			>
				<CompassIcon className="size-4" />
				<span className="sr-only">Start tour</span>
			</AppTourButton>
		</div>
	);
};
