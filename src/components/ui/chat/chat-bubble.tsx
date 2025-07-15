import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { Children, cloneElement, isValidElement } from "react";
import { ShinyText } from "@/components/chat/shiny-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, type buttonVariants } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ChatBubble
const chatBubbleVariant = cva(
	"group relative flex max-w-[60%] items-end gap-2",
	{
		variants: {
			variant: {
				received: "self-start",
				sent: "mb-4 flex-row-reverse self-end",
			},
			layout: {
				default: "",
				ai: "w-full max-w-full items-center",
			},
		},
		defaultVariants: {
			variant: "received",
			layout: "default",
		},
	},
);

interface ChatBubbleProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof chatBubbleVariant> {}

const ChatBubble = ({
	className,
	variant,
	layout,
	children,
	...props
}: ChatBubbleProps) => (
	<div
		data-slot="chat-bubble"
		className={cn(
			chatBubbleVariant({ variant, layout, className }),
			"group relative",
		)}
		{...props}
	>
		{Children.map(children, (child) =>
			isValidElement(child) && typeof child.type !== "string"
				? cloneElement(child, {
						variant,
						layout,
					} as React.ComponentProps<typeof child.type>)
				: child,
		)}
	</div>
);

// ChatBubbleAvatar
interface ChatBubbleAvatarProps {
	src?: string;
	Fallback?: string | LucideIcon;
	className?: string;
}

const ChatBubbleAvatar: React.FC<ChatBubbleAvatarProps> = ({
	src,
	Fallback,
	className,
}) => (
	<Avatar className={className}>
		<AvatarImage src={src} alt="Avatar" />
		<AvatarFallback>
			{typeof Fallback === "string" ? Fallback : Fallback ? <Fallback /> : null}
		</AvatarFallback>
	</Avatar>
);

// ChatBubbleMessage
const chatBubbleMessageVariants = cva("p-4", {
	variants: {
		variant: {
			received: "rounded-r-lg rounded-tl-lg bg-secondary text-foreground",
			sent: "rounded-l-lg rounded-tr-lg bg-primary/80 text-primary-foreground",
		},
		layout: {
			default: "",
			ai: "w-full rounded-none border-t bg-transparent",
		},
	},
	defaultVariants: {
		variant: "received",
		layout: "default",
	},
});

interface ChatBubbleMessageProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof chatBubbleMessageVariants> {
	isLoading?: boolean;
}

const ChatBubbleMessage = ({
	className,
	variant,
	layout,
	isLoading = false,
	children,
	...props
}: ChatBubbleMessageProps) => (
	<div
		data-slot="chat-bubble-message"
		className={cn(
			chatBubbleMessageVariants({ variant, layout, className }),
			"max-w-full whitespace-pre-wrap break-words",
		)}
		{...props}
	>
		{isLoading ? (
			<div className="flex items-center space-x-2">
				{/* <MessageLoading /> */}
				<ShinyText>Generating response...</ShinyText>
			</div>
		) : (
			children
		)}
	</div>
);

// ChatBubbleTimestamp
interface ChatBubbleTimestampProps
	extends React.HTMLAttributes<HTMLDivElement> {
	timestamp: string;
}

const ChatBubbleTimestamp: React.FC<ChatBubbleTimestampProps> = ({
	timestamp,
	className,
	...props
}) => (
	<div className={cn("mt-2 text-right text-xs", className)} {...props}>
		{timestamp}
	</div>
);

// ChatBubbleAction
type ChatBubbleActionProps = React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		icon: React.ReactNode;
		actionLabel?: string;
	};

const ChatBubbleAction: React.FC<ChatBubbleActionProps> = ({
	icon,
	actionLabel,
	onClick,
	className,
	variant = "ghost",
	size = "icon",
	...props
}) => (
	<Tooltip delayDuration={1000}>
		<TooltipTrigger asChild>
			<Button
				variant={variant}
				size={size}
				className={className}
				onClick={onClick}
				{...props}
			>
				{icon}
			</Button>
		</TooltipTrigger>

		{actionLabel && (
			<TooltipContent>
				<p>{actionLabel}</p>
			</TooltipContent>
		)}
	</Tooltip>
);

interface ChatBubbleActionWrapperProps
	extends React.HTMLAttributes<HTMLDivElement> {
	variant?: "sent" | "received";
	className?: string;
}

const ChatBubbleActionWrapper = ({
	variant,
	className,
	children,
	...props
}: ChatBubbleActionWrapperProps) => (
	<div
		data-slot="chat-bubble-action-wrapper"
		className={cn(
			"flex transition-opacity duration-200",
			{ "-right-1 absolute top-full flex-row-reverse": variant === "sent" },
			className,
		)}
		{...props}
	>
		{children}
	</div>
);

export {
	ChatBubble,
	ChatBubbleAction,
	ChatBubbleActionWrapper,
	ChatBubbleAvatar,
	ChatBubbleMessage,
	ChatBubbleTimestamp,
	chatBubbleMessageVariants,
	chatBubbleVariant,
};
