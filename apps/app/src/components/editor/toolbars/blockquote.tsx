import type { VariantProps } from "class-variance-authority";
import { TextQuote } from "lucide-react";
import { Button, type buttonVariants } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { useToolbar, useToolbarActive } from "./toolbar-provider";

const BlockquoteToolbar = ({
	className,
	onClick,
	children,
	...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) => {
	const { editor } = useToolbar();
	const isActive = useToolbarActive("blockquote");
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={m.editor_toolbar_blockquote_tooltip()}
						aria-pressed={isActive}
						className={cn(
							"h-8 w-8 p-0 sm:h-9 sm:w-9",
							isActive && "bg-accent",
							className,
						)}
						onClick={(e) => {
							editor?.chain().focus().toggleBlockquote().run();
							onClick?.(e);
						}}
						disabled={!editor?.can().chain().focus().toggleBlockquote().run()}
						{...props}
					>
						{children ?? <TextQuote className="h-4 w-4" />}
					</Button>
				}
			/>
			<TooltipContent>
				<span>{m.editor_toolbar_blockquote_tooltip()}</span>
			</TooltipContent>
		</Tooltip>
	);
};

export { BlockquoteToolbar };
