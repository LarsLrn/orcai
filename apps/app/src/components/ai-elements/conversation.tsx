import type { ComponentProps, RefObject } from "react";
import { createContext, useContext, useRef } from "react";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { cn } from "@/lib/utils";

export type ConversationProps = ComponentProps<typeof MessageScroller>;

const ConversationViewportContext =
	createContext<RefObject<HTMLDivElement | null> | null>(null);

export const Conversation = (props: ConversationProps) => {
	const viewport = useRef<HTMLDivElement>(null);

	return (
		<MessageScrollerProvider autoScroll>
			<ConversationViewportContext value={viewport}>
				<MessageScroller {...props} />
			</ConversationViewportContext>
		</MessageScrollerProvider>
	);
};

/** The scrolling element, for controls that react to the reader's position. */
export const useConversationViewport = () => {
	const viewport = useContext(ConversationViewportContext);
	if (!viewport) {
		throw new Error("useConversationViewport must be used within Conversation");
	}
	return viewport;
};

export type ConversationContentProps = ComponentProps<
	typeof MessageScrollerContent
>;

export const ConversationContent = ({
	className,
	...props
}: ConversationContentProps) => {
	const viewport = useConversationViewport();

	return (
		<MessageScrollerViewport ref={viewport}>
			<MessageScrollerContent className={cn("p-4", className)} {...props} />
		</MessageScrollerViewport>
	);
};

export type ConversationScrollButtonProps = ComponentProps<
	typeof MessageScrollerButton
>;

export const ConversationScrollButton = (
	props: ConversationScrollButtonProps,
) => <MessageScrollerButton {...props} />;

export const downloadConversation = <Message,>(
	messages: Message[],
	formatMessage: (message: Message) => string,
	filename = "conversation.md",
) => {
	const markdown = messages.map(formatMessage).join("\n\n");
	const blob = new Blob(
		[
			markdown,
		],
		{
			type: "text/markdown",
		},
	);
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.append(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
};
