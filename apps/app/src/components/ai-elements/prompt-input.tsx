import type { ChatStatus } from "ai";
import { ArrowUpIcon, PlusIcon, SquareIcon, XIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes, MouseEvent } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroupButton } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({
	className,
	...props
}: PromptInputToolsProps) => (
	<div
		className={cn("flex min-w-0 items-center gap-1", className)}
		{...props}
	/>
);

export type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>;

export const PromptInputActionMenu = (props: PromptInputActionMenuProps) => (
	<DropdownMenu {...props} />
);

export type PromptInputActionMenuTriggerProps = ComponentProps<
	typeof InputGroupButton
>;

export const PromptInputActionMenuTrigger = ({
	className,
	children,
	size = children ? "sm" : "icon-sm",
	...props
}: PromptInputActionMenuTriggerProps) => (
	<DropdownMenuTrigger
		render={
			<InputGroupButton
				className={cn("rounded-full", className)}
				size={size}
				variant="outline"
				{...props}
			/>
		}
	>
		{children ?? <PlusIcon />}
	</DropdownMenuTrigger>
);

export type PromptInputActionMenuContentProps = ComponentProps<
	typeof DropdownMenuContent
>;

export const PromptInputActionMenuContent = (
	props: PromptInputActionMenuContentProps,
) => <DropdownMenuContent align="start" {...props} />;

export type PromptInputActionMenuItemProps = ComponentProps<
	typeof DropdownMenuItem
>;

export const PromptInputActionMenuItem = (
	props: PromptInputActionMenuItemProps,
) => <DropdownMenuItem {...props} />;

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
	status?: ChatStatus;
	onStop?: () => void;
};

export const PromptInputSubmit = ({
	className,
	variant = "default",
	size = "icon-sm",
	status,
	onStop,
	onClick,
	children,
	...props
}: PromptInputSubmitProps) => {
	const isGenerating = status === "submitted" || status === "streaming";

	let icon = <ArrowUpIcon />;
	if (status === "submitted") {
		icon = <Spinner />;
	} else if (status === "streaming") {
		icon = <SquareIcon />;
	} else if (status === "error") {
		icon = <XIcon />;
	}

	const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
		if (isGenerating && onStop) {
			event.preventDefault();
			onStop();
			return;
		}
		onClick?.({
			...event,
			preventBaseUIHandler: event.preventDefault,
		});
	};

	return (
		<InputGroupButton
			aria-label={
				isGenerating
					? m.ai_elements_prompt_input_stop_aria_label()
					: m.ai_elements_prompt_input_submit_aria_label()
			}
			className={cn("rounded-full", className)}
			onClick={handleClick}
			size={size}
			type={isGenerating && onStop ? "button" : "submit"}
			variant={variant}
			{...props}
		>
			{children ?? icon}
		</InputGroupButton>
	);
};
