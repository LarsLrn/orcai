import { useEditorState } from "@tiptap/react";
import type { VariantProps } from "class-variance-authority";
import { Table } from "lucide-react";
import { Button, type buttonVariants } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { useToolbar } from "./toolbar-provider";

const NEW_TABLE = {
	rows: 3,
	cols: 3,
	withHeaderRow: true,
};

const TableToolbar = ({
	className,
	onClick,
	children,
	...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) => {
	const { editor } = useToolbar();
	const canInsert = useEditorState({
		editor,
		selector: ({ editor: current }) => current.can().insertTable(NEW_TABLE),
	});
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={m.editor_toolbar_table_tooltip()}
						className={cn("h-8 w-8 p-0 sm:h-9 sm:w-9", className)}
						onClick={(e) => {
							editor?.chain().focus().insertTable(NEW_TABLE).run();
							onClick?.(e);
						}}
						disabled={!canInsert}
						{...props}
					>
						{children ?? <Table className="h-4 w-4" />}
					</Button>
				}
			/>
			<TooltipContent>
				<span>{m.editor_toolbar_table_tooltip()}</span>
			</TooltipContent>
		</Tooltip>
	);
};

export { TableToolbar };
