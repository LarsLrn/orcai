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
		className="size-8 rounded-full"
		size="sm"
		onClick={(event) => {
			event.preventDefault();
			stop();
			setMessages((messages) => messages);
		}}
	>
		<StopCircleIcon className="size-4" />
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
		className="size-8 rounded-full"
		size="sm"
		onClick={(event) => {
			event.preventDefault();
			submitForm();
		}}
		disabled={input.length === 0}
	>
		<CornerDownLeft className="size-4" />
	</Button>
);
