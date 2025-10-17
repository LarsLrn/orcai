import type { VariantProps } from "class-variance-authority";
import { BoldIcon } from "lucide-react";
import { Button, type buttonVariants } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToolbar } from "./toolbar-provider";

const BoldToolbar = ({
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
						editor?.isActive("bold") && "bg-accent",
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
			</TooltipTrigger>
			<TooltipContent>
				<span>Bold</span>
				<span className="ml-1 text-gray-11 text-xs">(cmd + b)</span>
			</TooltipContent>
		</Tooltip>
	);
};

export { BoldToolbar };
