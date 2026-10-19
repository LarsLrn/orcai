import type { VariantProps } from "class-variance-authority";
import { BoldIcon } from "lucide-react";
import { Button, type buttonVariants } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { useToolbar, useToolbarActive } from "./toolbar-provider";

const BoldToolbar = ({
	className,
	onClick,
	children,
	...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) => {
	const { editor } = useToolbar();
	const isActive = useToolbarActive("bold");
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={m.editor_toolbar_bold_tooltip()}
						aria-pressed={isActive}
						className={cn(
							"h-8 w-8 p-0 sm:h-9 sm:w-9",
							isActive && "bg-accent",
							className,
						)}
						onClick={(e) => {
							editor?.chain().focus().toggleBold().run();
							onClick?.(e);
						}}
						disabled={!editor?.can().chain().focus().toggleBold().run()}
						{...props}
					>
						{children ?? <BoldIcon className="h-4 w-4" />}
					</Button>
				}
			/>
			<TooltipContent>
				<span>{m.editor_toolbar_bold_tooltip()}</span>
				<span className="ml-1 text-gray-11 text-xs">(cmd + b)</span>
			</TooltipContent>
		</Tooltip>
	);
};

export { BoldToolbar };
