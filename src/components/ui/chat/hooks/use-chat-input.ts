import type { UseChatHelpers } from "@ai-sdk/react";
import { useCallback, useRef, useState } from "react";
import { useWindowSize } from "usehooks-ts";
import { useUmami } from "@/hooks/use-umami";
import type { CustomUIMessage } from "@/lib/ai/tools";

interface UseChatInputProps {
	chatId: string;
	sendMessage: UseChatHelpers<CustomUIMessage>["sendMessage"];
	status?: UseChatHelpers<CustomUIMessage>["status"];
}

export const useChatInput = ({
	chatId,
	sendMessage,
	status,
}: UseChatInputProps) => {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const { width } = useWindowSize();
	const { trackEvent } = useUmami();

	const [input, setInput] = useState("");
	const isLoading = status === "streaming" || status === "submitted";

	const submitForm = useCallback(() => {
		if (!input.trim()) return;

		trackEvent("chat-request", { chatId });
		sendMessage({ text: input });
		setInput("");

		// Reset textarea height after submit
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}

		if (width && width > 768) {
			textareaRef.current?.focus();
		}
	}, [input, chatId, trackEvent, sendMessage, width]);

	const handleInput = useCallback(
		(event: React.ChangeEvent<HTMLTextAreaElement>) => {
			setInput(event.target.value);

			// Auto-resize textarea
			if (textareaRef.current) {
				textareaRef.current.style.height = "auto";
				textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
			}
		},
		[],
	);

	return {
		input,
		textareaRef,
		isLoading,
		submitForm,
		handleInput,
	};
};
