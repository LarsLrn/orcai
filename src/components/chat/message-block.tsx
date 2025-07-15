import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatRequestOptions, Message } from "ai";
import type { ApiGetScoresResponseData } from "langfuse";
import {
	CheckIcon,
	CopyIcon,
	DownloadIcon,
	ImageIcon,
	Loader2Icon,
	PencilIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
	ChatBubble,
	ChatBubbleAction,
	ChatBubbleActionWrapper,
	ChatBubbleMessage,
} from "@/components/ui/chat/chat-bubble";
import type { Chat } from "@/db/schema/chat";
import { cn } from "@/lib/utils";
import { AnnotationBlock } from "./annotation-block";
import { Markdown } from "./markdown";
import { MessageEditor } from "./message-editor";
import { MessageRate } from "./message-rate";

/* interface ToolStream {
  [key: string]: {
    content: string | undefined;
  };
} */

// TODO: This is a mess. Refactor into composable components

const MessageBlock = ({
	message,
	chatId,
	/* toolStream, */
	setMessages,
	reload,
	status,
	score,
	data, // Add data prop to receive data stream
}: {
	message: Message;
	chatId: Chat["id"];
	/* toolStream: ToolStream | null; */
	setMessages: (
		messages: Message[] | ((messages: Message[]) => Message[]),
	) => void;
	reload: (
		chatRequestOptions?: ChatRequestOptions,
	) => Promise<string | null | undefined>;
	status: UseChatHelpers["status"];
	score?: ApiGetScoresResponseData;
	data?: any[]; // Add data prop type
}) => {
	const [mode, setMode] = useState<"view" | "edit">("view");
	const [, copy] = useCopyToClipboard();

	const handleCopy = async (text: string) => {
		toast.promise(copy(text), {
			loading: "Copying to clipboard...",
			success: "Copied to clipboard!",
			error: (error) => ({
				message: "Failed to copy to clipboard",
				description: error.message,
			}),
		});
	};

	const handleDownloadImage = (imageData: string, prompt: string) => {
		try {
			// Convert base64 to blob
			const byteCharacters = atob(imageData);
			const byteNumbers = new Array(byteCharacters.length);
			for (let i = 0; i < byteCharacters.length; i++) {
				byteNumbers[i] = byteCharacters.charCodeAt(i);
			}
			const byteArray = new Uint8Array(byteNumbers);
			const blob = new Blob([byteArray], { type: "image/png" });

			// Create download link
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `generated-image-${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "-")}.png`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);

			toast.success("Image downloaded successfully!");
		} catch (_error) {
			toast.error("Failed to download image");
		}
	};

	const handleModeChange = () => {
		if (mode === "view") {
			setMode("edit");
		} else {
			setMode("view");
		}
	};

	const variant = message.role === "user" ? "sent" : "received";

	const actionIcons = [
		{
			icon: CopyIcon,
			type: "Copy",
			fn: () =>
				handleCopy(
					message.parts?.find((message) => message.type === "text")?.text ?? "",
				),
		},
	];

	const userActionIcons = [
		{ icon: PencilIcon, type: "Edit", fn: handleModeChange },
		{
			icon: CopyIcon,
			type: "Copy",
			fn: () =>
				handleCopy(
					message.parts?.find((message) => message.type === "text")?.text ?? "",
				),
		},
	];

	// Filter image data from the data stream for this specific message
	const imageData =
		data?.filter(
			(item) => item.type === "image" && item.messageId === message.id,
		) || [];

	return (
		<ChatBubble
			variant={variant}
			className={cn("items-start", {
				"max-w-full": variant === "received",
			})}
		>
			{/* {variant === "received" && (
        <ChatBubbleAvatar
          className="mt-4"
          Fallback={message.role === "user" ? UserIcon : BotIcon}
        />
      )} */}
			<AnimatePresence>
				<motion.div
					initial={{ y: 5, opacity: 0 }}
					whileInView={{ y: 0, opacity: 1 }}
					transition={{ duration: 0.5, ease: "easeIn" }}
					data-role={message.role}
				>
					<ChatBubbleMessage
						isLoading={message.parts?.length === 0 && status === "streaming"}
						variant={variant}
						className={cn(
							{
								"w-[calc(100dvw-31px)] rounded-none bg-transparent md:w-[calc(100dvw-316px)] lg:max-w-[800px]":
									variant === "received",
							},
							"sticky",
						)}
					>
						{message.parts?.map((part, i) => (
							<div key={`${part.type}${message.id}${i}`}>
								{part.type === "reasoning" && (
									<Accordion
										type="single"
										collapsible
										key={part.type}
										className="mb-4 rounded-2xl border bg-card px-4"
									>
										<AccordionItem value="item-1">
											<AccordionTrigger className="py-2">
												Show Reasoning
											</AccordionTrigger>
											<AccordionContent>
												<Markdown className="text-sm">
													{part.reasoning}
												</Markdown>
											</AccordionContent>
										</AccordionItem>
									</Accordion>
								)}

								{part.type === "tool-invocation" &&
									part.toolInvocation.state === "result" &&
									part.toolInvocation.toolName === "generateImage" && (
										<div
											key={`${part.toolInvocation.toolCallId}${i}`}
											className="mb-6 space-y-4"
										>
											<div className="flex items-center space-x-2 text-muted-foreground text-sm">
												<ImageIcon className="h-4 w-4" />
												<span>{part.toolInvocation.result.description}</span>
											</div>
											{imageData.length > 0 && variant === "received" && (
												<div className="space-y-6">
													{imageData.map((image, index) => (
														<div
															key={`image-${image.messageId}-${image.prompt}-${index}`}
															className="space-y-3"
														>
															<div className="flex items-center space-x-2 text-muted-foreground text-sm">
																<ImageIcon className="h-4 w-4" />
																<span className="font-medium">
																	Generated image:
																</span>
																<span>{image.prompt}</span>
															</div>
															<div className="group relative overflow-hidden rounded-xl border bg-muted/20 shadow-sm transition-all hover:shadow-md">
																<img
																	src={`data:image/png;base64,${image.image}`}
																	alt={image.prompt}
																	width={400}
																	height={400}
																	className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.02]"
																/>
																<Button
																	size="sm"
																	variant="default"
																	className="absolute top-2 right-2 h-8 w-8 p-0 opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100"
																	onClick={() =>
																		handleDownloadImage(
																			image.image,
																			image.prompt,
																		)
																	}
																	title="Download image"
																>
																	<DownloadIcon className="h-4 w-4" />
																</Button>
															</div>
														</div>
													))}
												</div>
											)}
										</div>
									)}

								{part.type === "tool-invocation" &&
									(part.toolInvocation.state === "call" ||
										part.toolInvocation.state === "partial-call") && (
										<div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/50 p-4">
											<Loader2Icon className="h-4 w-4 animate-spin text-primary" />
											<div className="flex flex-col gap-1">
												<p className="font-medium text-foreground text-sm">
													Calling tool {part.toolInvocation.toolName}
												</p>
												<p className="text-muted-foreground text-xs">
													Please wait while we process your request...
												</p>
											</div>
										</div>
									)}

								{part.type === "tool-invocation" &&
									part.toolInvocation.toolName === "generateJoke" &&
									part.toolInvocation.state === "result" && (
										<div className="mb-4 flex items-center gap-3 rounded-lg border border-dashed bg-muted/50 p-4">
											<CheckIcon className="h-4 w-4 text-primary" />
											<div className="flex flex-col gap-1">
												<p className="font-medium text-foreground text-sm">
													Called tool {part.toolInvocation.toolName}
												</p>
												<p className="text-muted-foreground text-xs">
													Style: {part.toolInvocation.result.style}
												</p>
												<p className="text-muted-foreground text-xs">
													Topic: {part.toolInvocation.result.topic}
												</p>
											</div>
										</div>
									)}

								{part.type === "text" && variant === "sent" && (
									<div>
										{mode === "edit" ? (
											<MessageEditor
												chatId={chatId}
												key={message.id}
												message={message}
												setMode={setMode}
												setMessages={setMessages}
												reload={reload}
												status={status}
											/>
										) : (
											part.text
										)}
									</div>
								)}

								{part.type === "text" && variant === "received" && (
									<Markdown className="text-foreground">{part.text}</Markdown>
								)}

								{/* {part.type === "tool-invocation" && (
                  <ToolBlock
                    key={part.toolInvocation.toolCallId}
                    tool={part.toolInvocation}
                    toolStream={
                      toolStream?.[part.toolInvocation.toolCallId]?.content
                    }
                  />
                )} */}
							</div>
						))}

						<AnnotationBlock
							annotations={message.annotations}
							id="ai-annotations"
						/>
						{message.role === "user" && (
							<ChatBubbleActionWrapper
								variant="sent"
								className="w-full gap-2 pt-2"
							>
								{userActionIcons.map(({ icon: Icon, type, fn }) => (
									<ChatBubbleAction
										className="size-6 text-primary"
										actionLabel={type}
										key={type}
										icon={<Icon className="size-3" />}
										onClick={fn}
									/>
								))}
							</ChatBubbleActionWrapper>
						)}
						{message.role === "assistant" && (
							<ChatBubbleActionWrapper
								variant="received"
								className="gap-2 pt-2"
							>
								{actionIcons.map(({ icon: Icon, type, fn }) => (
									<ChatBubbleAction
										className="size-6"
										actionLabel={type}
										key={type}
										icon={<Icon className="size-3" />}
										onClick={fn}
									/>
								))}
								<MessageRate
									chatId={chatId}
									messageId={message.id}
									score={score}
									id="ai-message-rate"
								/>
							</ChatBubbleActionWrapper>
						)}
					</ChatBubbleMessage>
				</motion.div>
			</AnimatePresence>
		</ChatBubble>
	);
};

export { MessageBlock };
