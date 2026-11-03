import type { VariantProps } from "class-variance-authority";
import { Strikethrough } from "lucide-react";
import { Button, type buttonVariants } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { useToolbar, useToolbarState } from "./toolbar-provider";

const StrikeThroughToolbar = ({
	className,
	onClick,
	children,
	...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) => {
	const { editor } = useToolbar();
	const { isActive, canToggle } = useToolbarState((current) => ({
		isActive: current.isActive("strike"),
		canToggle: current.can().toggleStrike(),
	}));
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={m.editor_toolbar_strikethrough_tooltip()}
						aria-pressed={isActive}
						className={cn(
							"h-8 w-8 p-0 sm:h-9 sm:w-9",
							isActive && "bg-accent",
							className,
						)}
						onClick={(e) => {
							editor?.chain().focus().toggleStrike().run();
							onClick?.(e);
						}}
						disabled={!canToggle}
						{...props}
					>
						{children ?? <Strikethrough className="h-4 w-4" />}
					</Button>
				}
			/>
			<TooltipContent>
				<span>{m.editor_toolbar_strikethrough_tooltip()}</span>
				<span className="ml-1 text-xs">(cmd + shift + x)</span>
			</TooltipContent>
		</Tooltip>
	);
};

export { StrikeThroughToolbar };
