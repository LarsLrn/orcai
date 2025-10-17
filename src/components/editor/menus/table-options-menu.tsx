import type { Editor } from "@tiptap/core";
import { FloatingMenu } from "@tiptap/react/menus";
import {
	Columns,
	MoreHorizontal,
	RectangleHorizontal,
	Rows,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const TableOptionsMenu = ({ editor }: { editor: Editor }) => {
	if (!editor) {
		return null;
	}

	const menuItemClass = cn("rounded-md px-2 py-1.5 text-sm hover:bg-accent");

	return (
		<FloatingMenu
			editor={editor}
			options={{
				placement: "top-end",
				inline: true,
				offset: { mainAxis: 8, crossAxis: 0 },
			}}
			className={cn("flex w-fit max-w-[90vw] space-x-0.5")}
			shouldShow={({ editor }) => {
				return editor.isActive("table");
			}}
		>
			<TooltipProvider delayDuration={300}>
				<Popover>
					<Tooltip>
						<PopoverTrigger asChild>
							<TooltipTrigger asChild>
								<Button
									className="drop-shadow-lg"
									variant="outline"
									size="icon"
								>
									<Columns className="size-5" />
								</Button>
							</TooltipTrigger>
						</PopoverTrigger>
						<TooltipContent>Column</TooltipContent>
					</Tooltip>
					<PopoverContent
						className="flex max-h-80 w-40 flex-col overflow-hidden overflow-y-auto rounded border p-1 shadow-xl"
						align="end"
					>
						<div className="flex flex-col">
							<button
								type="button"
								onClick={() => {
									editor.chain().focus().addColumnBefore().run();
								}}
								className={menuItemClass}
							>
								Add column before
							</button>
							<button
								type="button"
								onClick={() => {
									editor.chain().focus().addColumnAfter().run();
								}}
								className={menuItemClass}
							>
								Add column after
							</button>
							<button
								type="button"
								onClick={() => {
									editor.chain().focus().deleteColumn().run();
								}}
								className={cn([menuItemClass], "text-destructive")}
							>
								Delete column
							</button>
						</div>
					</PopoverContent>
				</Popover>

				<Popover>
					<Tooltip>
						<PopoverTrigger asChild>
							<TooltipTrigger asChild>
								<Button
									className="drop-shadow-lg"
									variant="outline"
									size="icon"
								>
									<Rows className="size-5" />
								</Button>
							</TooltipTrigger>
						</PopoverTrigger>
						<TooltipContent>Row</TooltipContent>
					</Tooltip>
					<PopoverContent
						className="flex max-h-80 w-40 flex-col overflow-hidden overflow-y-auto rounded border p-1 shadow-xl"
						align="end"
					>
						<div className="flex flex-col">
							<button
								type="button"
								onClick={() => {
									editor.chain().focus().addRowBefore().run();
								}}
								className={menuItemClass}
							>
								Add row before
							</button>
							<button
								type="button"
								onClick={() => {
									editor.chain().focus().addRowAfter().run();
								}}
								className={menuItemClass}
							>
								Add row after
							</button>
							<button
								type="button"
								onClick={() => {
									editor.chain().focus().deleteRow().run();
								}}
								className={cn([menuItemClass], "text-destructive")}
							>
								Delete row
							</button>
						</div>
					</PopoverContent>
				</Popover>

				<Popover>
					<Tooltip>
						<PopoverTrigger asChild>
							<TooltipTrigger asChild>
								<Button
									className="drop-shadow-lg"
									variant="outline"
									size="icon"
								>
									<RectangleHorizontal className="size-5" />
								</Button>
							</TooltipTrigger>
						</PopoverTrigger>
						<TooltipContent>Cell</TooltipContent>
					</Tooltip>
					<PopoverContent
						className="flex max-h-80 w-40 flex-col overflow-hidden overflow-y-auto rounded border p-1 shadow-xl"
						align="end"
					>
						<div className="flex flex-col">
							<button
								type="button"
								onClick={() => {
									editor.chain().focus().mergeCells().run();
								}}
								className={menuItemClass}
							>
								Merge cells
							</button>
							<button
								type="button"
								onClick={() => {
									editor.chain().focus().splitCell().run();
								}}
								className={menuItemClass}
							>
								Split cell
							</button>
							<button
								type="button"
								onClick={() => {
									editor.chain().focus().toggleHeaderCell().run();
								}}
								className={menuItemClass}
							>
								Toggle header cell
							</button>
						</div>
					</PopoverContent>
				</Popover>

				<Popover>
					<Tooltip>
						<PopoverTrigger asChild>
							<TooltipTrigger asChild>
								<Button
									className="drop-shadow-lg"
									variant="outline"
									size="icon"
								>
									<MoreHorizontal className="size-5" />
								</Button>
							</TooltipTrigger>
						</PopoverTrigger>
						<TooltipContent>Options</TooltipContent>
					</Tooltip>
					<PopoverContent
						className="flex max-h-80 w-40 flex-col overflow-hidden overflow-y-auto rounded border p-1 shadow-xl"
						align="end"
					>
						<div className="flex flex-col">
							<button
								type="button"
								onClick={() => {
									editor.chain().focus().toggleHeaderRow().run();
								}}
								className={menuItemClass}
							>
								Toggle header row
							</button>
							<button
								type="button"
								onClick={() => {
									editor.chain().focus().toggleHeaderColumn().run();
								}}
								className={menuItemClass}
							>
								Toggle header col
							</button>
							<button
								type="button"
								onClick={() => {
									editor.chain().focus().deleteTable().run();
								}}
								className={cn([menuItemClass], "text-destructive")}
							>
								Delete table
							</button>
						</div>
					</PopoverContent>
				</Popover>
			</TooltipProvider>
		</FloatingMenu>
	);
};
