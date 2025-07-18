import type { UseChatHelpers } from "@ai-sdk/react";
import { CornerDownLeft, StopCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CustomUIMessage } from "@/lib/ai/tools";

export const StopButton = ({
	stop,
	setMessages,
}: {
	stop: () => void;
	setMessages: UseChatHelpers<CustomUIMessage>["setMessages"];
}) => (
	<Button
		className="rounded-full"
		size="icon"
		onClick={(event) => {
			event.preventDefault();
			stop();
			setMessages((messages) => messages);
		}}
	>
		<StopCircleIcon />
	</Button>
);

export const SendButton = ({
	submitForm,
	input,
}: {
	submitForm: () => void;
	input: string;
}) => (
	<Button
		className="rounded-full"
		size="icon"
		onClick={(event) => {
			event.preventDefault();
			submitForm();
		}}
		disabled={input.length === 0}
	>
		<CornerDownLeft />
	</Button>
);
