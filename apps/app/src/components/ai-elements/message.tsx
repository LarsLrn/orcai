import type { UIMessage } from "ai";
import type { ComponentProps } from "react";
import { createContext, memo, useContext } from "react";
import { CiteComponent } from "@/components/ai-elements/cite";
import {
	StreamdownContent,
	type StreamdownContentProps,
} from "@/components/ai-elements/streamdown-content";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
	MessageContent as MessageBody,
	MessageFooter,
	Message as MessageRoot,
} from "@/components/ui/message";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const MessageFromContext = createContext<UIMessage["role"]>("assistant");

export type MessageProps = ComponentProps<typeof MessageRoot> & {
	from: UIMessage["role"];
};

export const Message = ({ from, ...props }: MessageProps) => (
	<MessageFromContext value={from}>
		<MessageRoot align={from === "user" ? "end" : "start"} {...props} />
	</MessageFromContext>
);

export type MessageContentProps = ComponentProps<typeof MessageBody>;

export const MessageContent = ({ children, ...props }: MessageContentProps) => {
	const from = useContext(MessageFromContext);

	return (
		<MessageBody {...props}>
			{from === "user" ? (
				<Bubble align="end" variant="muted">
					<BubbleContent className="flex flex-col gap-2">
						{children}
					</BubbleContent>
				</Bubble>
			) : (
				children
			)}
		</MessageBody>
	);
};

export type MessageActionsProps = ComponentProps<typeof MessageFooter>;

export const MessageActions = ({
	className,
	...props
}: MessageActionsProps) => (
	<MessageFooter className={cn("gap-1", className)} {...props} />
);

export type MessageActionProps = ComponentProps<typeof Button> & {
	tooltip?: string;
	label?: string;
};

export const MessageAction = ({
	tooltip,
	label,
	variant = "ghost",
	size = "icon-sm",
	...props
}: MessageActionProps) => {
	const button = (
		<Button
			aria-label={label ?? tooltip}
			size={size}
			type="button"
			variant={variant}
			{...props}
		/>
	);

	if (!tooltip) {
		return button;
	}

	return (
		<Tooltip>
			<TooltipTrigger render={button} />
			<TooltipContent>
				<p>{tooltip}</p>
			</TooltipContent>
		</Tooltip>
	);
};

export type MessageResponseProps = StreamdownContentProps;

const streamdownComponents = {
	cite: CiteComponent,
};

const streamdownAllowedTags = {
	cite: [
		"assetid",
		"assetId",
		"asset_id",
		"title",
		"page",
		"pageNumber",
		"page_number",
	],
};

const streamdownLiteralTagContent = [
	"cite",
];

export const MessageResponse = memo(
	({ className, ...props }: MessageResponseProps) => (
		<StreamdownContent
			allowedTags={streamdownAllowedTags}
			className={cn(
				"wrap-break-word w-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
				"[&_h1]:font-semibold [&_h1]:text-2xl [&_h1]:tracking-tight [&_h2]:font-semibold [&_h2]:text-base [&_h2]:tracking-tight [&_h3]:font-medium [&_h3]:text-sm [&_h4]:font-medium [&_h4]:text-sm",
				"[&_table]:rounded-xl [&_table]:text-sm",
				className,
			)}
			components={streamdownComponents}
			literalTagContent={streamdownLiteralTagContent}
			{...props}
		/>
	),
	(prevProps, nextProps) =>
		prevProps.children === nextProps.children &&
		nextProps.isAnimating === prevProps.isAnimating,
);

MessageResponse.displayName = "MessageResponse";

export type MessageToolbarProps = ComponentProps<"div">;

export const MessageToolbar = ({
	className,
	children,
	...props
}: MessageToolbarProps) => (
	<div
		className={cn(
			"mt-4 flex w-full items-center justify-between gap-4",
			className,
		)}
		{...props}
	>
		{children}
	</div>
);
