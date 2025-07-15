"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatRequestOptions, Message } from "ai";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
/* import { deleteTrailingMessages } from "@/db/actions/ai-actions"; */
import type { Chat } from "@/db/schema/chat";

type MessageEditorProps = {
	chatId: Chat["id"];
	message: Message;
	setMode: React.Dispatch<React.SetStateAction<"view" | "edit">>;
	setMessages: (
		messages: Message[] | ((messages: Message[]) => Message[]),
	) => void;
	reload: (
		chatRequestOptions?: ChatRequestOptions,
	) => Promise<string | null | undefined>;
	status: UseChatHelpers["status"];
};

const MessageEditor = ({
	chatId,
	message,
	setMode,
	setMessages,
	reload,
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

	const handleEdit = async () => {
		const messageId = message.id;

		if (!messageId) {
			toast.error("Something went wrong, please try again!");
			return;
		}

		/* await deleteTrailingMessages({
			chatId,
			messageId: messageId,
		}); */

		setMessages((messages) => {
			const index = messages.findIndex((m) => m.id === message.id);

			if (index !== -1) {
				const updatedMessage: Message = {
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
					content: draftContent,
				};

				return [...messages.slice(0, index), updatedMessage];
			}

			return messages;
		});

		setMode("view");
		reload();
	};

	return (
		<div className="flex w-full flex-col gap-2">
			<Textarea
				ref={textareaRef}
				className="!text-base w-full resize-none overflow-hidden rounded-xl bg-transparent outline-none dark:bg-transparent"
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
