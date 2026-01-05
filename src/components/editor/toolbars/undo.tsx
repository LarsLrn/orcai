import type { VariantProps } from "class-variance-authority";
import { Undo2 } from "lucide-react";
import { Button, type buttonVariants } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToolbar } from "./toolbar-provider";

const UndoToolbar = ({
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
						className={cn("h-8 w-8 p-0 sm:h-9 sm:w-9", className)}
						onClick={(e) => {
							editor?.chain().focus().undo().run();
							onClick?.(e);
						}}
						disabled={!editor?.can().chain().focus().undo().run()}
						{...props}
					>
						{children ?? <Undo2 className="h-4 w-4" />}
					</Button>
				}
			/>
			<TooltipContent>
				<span>Undo</span>
			</TooltipContent>
		</Tooltip>
	);
};

export { UndoToolbar };
