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
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

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
				offset: {
					mainAxis: 8,
					crossAxis: 0,
				},
			}}
			className={cn("flex w-fit max-w-[90vw] space-x-0.5")}
			shouldShow={({ editor }) => {
				return editor.isActive("table");
			}}
		>
			<Popover>
				<Tooltip>
					<PopoverTrigger
						render={
							<TooltipTrigger
								render={
									<Button
										className="drop-shadow-lg"
										variant="outline"
										size="icon"
									>
										<Columns className="size-5" />
									</Button>
								}
							/>
						}
					/>
					<TooltipContent>{m.editor_table_column_tooltip()}</TooltipContent>
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
							{m.editor_table_add_column_before_action()}
						</button>
						<button
							type="button"
							onClick={() => {
								editor.chain().focus().addColumnAfter().run();
							}}
							className={menuItemClass}
						>
							{m.editor_table_add_column_after_action()}
						</button>
						<button
							type="button"
							onClick={() => {
								editor.chain().focus().deleteColumn().run();
							}}
							className={cn(
								[
									menuItemClass,
								],
								"text-destructive",
							)}
						>
							{m.editor_table_delete_column_action()}
						</button>
					</div>
				</PopoverContent>
			</Popover>

			<Popover>
				<Tooltip>
					<PopoverTrigger
						render={
							<TooltipTrigger
								render={
									<Button
										className="drop-shadow-lg"
										variant="outline"
										size="icon"
									>
										<Rows className="size-5" />
									</Button>
								}
							/>
						}
					/>
					<TooltipContent>{m.editor_table_row_tooltip()}</TooltipContent>
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
							{m.editor_table_add_row_before_action()}
						</button>
						<button
							type="button"
							onClick={() => {
								editor.chain().focus().addRowAfter().run();
							}}
							className={menuItemClass}
						>
							{m.editor_table_add_row_after_action()}
						</button>
						<button
							type="button"
							onClick={() => {
								editor.chain().focus().deleteRow().run();
							}}
							className={cn(
								[
									menuItemClass,
								],
								"text-destructive",
							)}
						>
							{m.editor_table_delete_row_action()}
						</button>
					</div>
				</PopoverContent>
			</Popover>

			<Popover>
				<Tooltip>
					<PopoverTrigger
						render={
							<TooltipTrigger
								render={
									<Button
										className="drop-shadow-lg"
										variant="outline"
										size="icon"
									>
										<RectangleHorizontal className="size-5" />
									</Button>
								}
							/>
						}
					/>
					<TooltipContent>{m.editor_table_cell_tooltip()}</TooltipContent>
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
							{m.editor_table_merge_cells_action()}
						</button>
						<button
							type="button"
							onClick={() => {
								editor.chain().focus().splitCell().run();
							}}
							className={menuItemClass}
						>
							{m.editor_table_split_cell_action()}
						</button>
						<button
							type="button"
							onClick={() => {
								editor.chain().focus().toggleHeaderCell().run();
							}}
							className={menuItemClass}
						>
							{m.editor_table_toggle_header_cell_action()}
						</button>
					</div>
				</PopoverContent>
			</Popover>

			<Popover>
				<Tooltip>
					<PopoverTrigger
						render={
							<TooltipTrigger
								render={
									<Button
										className="drop-shadow-lg"
										variant="outline"
										size="icon"
									>
										<MoreHorizontal className="size-5" />
									</Button>
								}
							/>
						}
					/>
					<TooltipContent>{m.editor_table_options_tooltip()}</TooltipContent>
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
							{m.editor_table_toggle_header_row_action()}
						</button>
						<button
							type="button"
							onClick={() => {
								editor.chain().focus().toggleHeaderColumn().run();
							}}
							className={menuItemClass}
						>
							{m.editor_table_toggle_header_column_action()}
						</button>
						<button
							type="button"
							onClick={() => {
								editor.chain().focus().deleteTable().run();
							}}
							className={cn(
								[
									menuItemClass,
								],
								"text-destructive",
							)}
						>
							{m.editor_table_delete_table_action()}
						</button>
					</div>
				</PopoverContent>
			</Popover>
		</FloatingMenu>
	);
};
