import type { UseChatHelpers } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CustomUIMessage } from "@/lib/ai/tools";

type MessageEditorProps = {
	message: CustomUIMessage;
	setMode: React.Dispatch<React.SetStateAction<"view" | "edit">>;
	setMessages: UseChatHelpers<CustomUIMessage>["setMessages"];
	regenerate: UseChatHelpers<CustomUIMessage>["regenerate"];
	status: UseChatHelpers<CustomUIMessage>["status"];
};

const MessageEditor = ({
	message,
	setMode,
	setMessages,
	regenerate,
	status,
}: MessageEditorProps) => {
	const [draftContent, setDraftContent] = useState<string>(
		message.parts?.find((part) => part.type === "text")?.text || "",
	);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isLoading = status === "streaming" || status === "submitted";

	// biome-ignore lint/correctness/useExhaustiveDependencies: <FIXME: Check later>
	useEffect(() => {
		if (textareaRef.current) {
			adjustHeight();
		}
	}, []);

	const adjustHeight = () => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
		}
	};

	const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
		setDraftContent(event.target.value);
		adjustHeight();
	};

	const handleEdit = () => {
		const messageId = message.id;

		if (!messageId) {
			toast.error("Something went wrong, please try again!");
			return;
		}

		setMessages((messages) => {
			const index = messages.findIndex((m) => m.id === message.id);

			if (index !== -1) {
				const updatedMessage: CustomUIMessage = {
					...message,
					parts: message.parts?.map((part) => {
						if (part.type === "text") {
							return {
								...part,
								text: draftContent,
							};
						}

						return part;
					}),
				};

				return [...messages.slice(0, index), updatedMessage];
			}

			return messages;
		});

		setMode("view");
		regenerate();
	};

	return (
		<div className="flex w-full flex-col gap-2">
			<Textarea
				ref={textareaRef}
				className="w-full resize-none overflow-hidden rounded-xl bg-transparent text-base! outline-none dark:bg-transparent"
				value={draftContent}
				onChange={handleInput}
			/>

			<div className="flex flex-row justify-end gap-2 text-card-foreground">
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						setMode("view");
					}}
				>
					Cancel
				</Button>
				<Button
					variant="default"
					size="sm"
					disabled={isLoading}
					onClick={handleEdit}
				>
					{isLoading ? "Generating..." : "Edit"}
				</Button>
			</div>
		</div>
	);
};

export { MessageEditor };
