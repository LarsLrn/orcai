import type { Editor } from "@tiptap/core";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlignmentTooolbar } from "./alignment";
import { BlockquoteToolbar } from "./blockquote";
import { BoldToolbar } from "./bold";
import { BulletListToolbar } from "./bullet-list";
import { ClearFormattingToolbar } from "./clear-formatting";
import { CodeToolbar } from "./code";
import { ColorHighlightToolbar } from "./color-and-highlight";
import { HeadingsToolbar } from "./headings";
import { HorizontalRuleToolbar } from "./horizontal-rule";
import { ItalicToolbar } from "./italic";
import { LinkToolbar } from "./link";
import { OrderedListToolbar } from "./ordered-list";
import { RedoToolbar } from "./redo";
import { StrikeThroughToolbar } from "./strikethrough";
import { TableToolbar } from "./table";
import { ToolbarProvider } from "./toolbar-provider";
import { UnderlineToolbar } from "./underline";
import { UndoToolbar } from "./undo";
import { YoutubeToolbar } from "./youtube";

const GroupSeparator = () => (
	<Separator orientation="vertical" className="mx-1 h-7" />
);

export const EditorToolbar = ({ editor }: { editor: Editor }) => {
	return (
		<div className="sticky top-0 w-full border-b bg-background">
			<ToolbarProvider editor={editor}>
				<ScrollArea className="h-fit py-0.5">
					<div className="flex w-max items-center gap-1 px-2">
						<UndoToolbar />
						<RedoToolbar />
						<GroupSeparator />

						<HeadingsToolbar />
						<GroupSeparator />

						<BoldToolbar />
						<ItalicToolbar />
						<UnderlineToolbar />
						<StrikeThroughToolbar />
						<CodeToolbar />
						<ColorHighlightToolbar />
						<GroupSeparator />

						<LinkToolbar />
						<GroupSeparator />

						<BulletListToolbar />
						<OrderedListToolbar />
						<BlockquoteToolbar />
						<GroupSeparator />

						<AlignmentTooolbar />
						<GroupSeparator />

						<TableToolbar />
						<YoutubeToolbar />
						<HorizontalRuleToolbar />
						<GroupSeparator />

						<ClearFormattingToolbar />
					</div>
					<ScrollBar orientation="horizontal" />
				</ScrollArea>
			</ToolbarProvider>
		</div>
	);
};
