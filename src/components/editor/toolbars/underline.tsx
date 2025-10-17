import type { VariantProps } from "class-variance-authority";
import { UnderlineIcon } from "lucide-react";
import { Button, type buttonVariants } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToolbar } from "./toolbar-provider";

const UnderlineToolbar = ({
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
						editor?.isActive("underline") && "bg-accent",
						className,
					)}
					onClick={(e) => {
						editor?.chain().focus().toggleUnderline().run();
						onClick?.(e);
					}}
					disabled={!editor?.can().chain().focus().toggleUnderline().run()}
					{...props}
				>
					{children ?? <UnderlineIcon className="h-4 w-4" />}
				</Button>
			</TooltipTrigger>
			<TooltipContent>
				<span>Underline</span>
				<span className="ml-1 text-gray-11 text-xs">(cmd + u)</span>
			</TooltipContent>
		</Tooltip>
	);
};

export { UnderlineToolbar };
