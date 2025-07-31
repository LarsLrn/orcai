import type { UseChatHelpers } from "@ai-sdk/react";
import { toast } from "sonner";
import { useChatInput } from "@/components/ui/chat/hooks/use-chat-input";
import { Textarea } from "@/components/ui/textarea";
import type { CustomUIMessage } from "@/lib/ai/tools";
import { cn } from "@/lib/utils";
import {
	ChatInputActions,
	ChatInputUtilityActions,
} from "./chat-input-actions";

interface ChatInputProps
	extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
	status?: UseChatHelpers<CustomUIMessage>["status"];
	chatId: string;
	sendMessage: UseChatHelpers<CustomUIMessage>["sendMessage"];
	handleReload: () => void;
	setMessages: UseChatHelpers<CustomUIMessage>["setMessages"];
	stop: UseChatHelpers<CustomUIMessage>["stop"];
	hasMessages: boolean;
}

const ChatInput = ({
	className,
	status,
	chatId,
	sendMessage,
	handleReload,
	setMessages,
	stop,
	hasMessages,
	...props
}: ChatInputProps) => {
	const { input, textareaRef, isLoading, submitForm, handleInput } =
		useChatInput({ chatId, sendMessage, status });

	const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();

			if (isLoading) {
				toast.error("Please wait for the current response to finish.");
			} else {
				submitForm();
			}
		}
	};

	return (
		<form className="mx-auto flex w-full gap-2 bg-background px-4 pb-4 md:max-w-3xl md:pb-6">
			<div className="flex w-full flex-col gap-3">
				<div className="relative rounded-2xl bg-card">
					<Textarea
						data-slot="chat-input"
						ref={textareaRef}
						value={input}
						onChange={handleInput}
						onKeyDown={handleKeyDown}
						className={cn(
							"max-h-[calc(75dvh)] min-h-[48px] resize-none border-0 bg-transparent p-3 pr-12 text-base outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
							className,
						)}
						rows={2}
						autoFocus
						maxLength={5000}
						placeholder={props.placeholder}
						style={{ border: "none", boxShadow: "none" }}
						{...props}
					/>

					<div className="absolute right-2 bottom-3">
						<ChatInputActions
							status={status}
							input={input}
							submitForm={submitForm}
							stop={stop}
							setMessages={setMessages}
						/>
					</div>
				</div>

				<ChatInputUtilityActions
					hasMessages={hasMessages}
					handleReload={handleReload}
				/>
			</div>
		</form>
	);
};

export { ChatInput };
