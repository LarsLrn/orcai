import type { VariantProps } from "class-variance-authority";
import { Strikethrough } from "lucide-react";
import { Button, type buttonVariants } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToolbar } from "./toolbar-provider";

const StrikeThroughToolbar = ({
	className,
	onClick,
	children,
	...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) => {
	const { editor } = useToolbar();
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className={cn(
						"h-8 w-8 p-0 sm:h-9 sm:w-9",
						editor?.isActive("strike") && "bg-accent",
						className,
					)}
					onClick={(e) => {
						editor?.chain().focus().toggleStrike().run();
						onClick?.(e);
					}}
					disabled={!editor?.can().chain().focus().toggleStrike().run()}
					{...props}
				>
					{children ?? <Strikethrough className="h-4 w-4" />}
				</Button>
			</TooltipTrigger>
			<TooltipContent>
				<span>Strikethrough</span>
				<span className="ml-1 text-gray-11 text-xs">(cmd + shift + x)</span>
			</TooltipContent>
		</Tooltip>
	);
};

export { StrikeThroughToolbar };
