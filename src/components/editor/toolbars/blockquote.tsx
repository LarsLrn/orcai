import type { VariantProps } from "class-variance-authority";
import { TextQuote } from "lucide-react";
import { Button, type buttonVariants } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToolbar } from "./toolbar-provider";

const BlockquoteToolbar = ({
	className,
	onClick,
	children,
	...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) => {
	const { editor } = useToolbar();
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className={cn(
							"h-8 w-8 p-0 sm:h-9 sm:w-9",
							editor?.isActive("blockquote") && "bg-accent",
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
				<span>Blockquote</span>
			</TooltipContent>
		</Tooltip>
	);
};

export { BlockquoteToolbar };
