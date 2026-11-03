import type { Editor } from "@tiptap/core";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { controls } from "../controls";
import { AlignmentToolbar } from "./alignment";
import { ColorHighlightToolbar } from "./color-and-highlight";
import { ControlButton } from "./control-button";
import { HeadingsToolbar } from "./headings";
import { LinkToolbar } from "./link";
import { ToolbarProvider } from "./toolbar-provider";
import { YoutubeToolbar } from "./youtube";

const GroupSeparator = () => (
	<Separator orientation="vertical" className="mx-1 h-7" />
);

export const EditorToolbar = ({ editor }: { editor: Editor }) => {
	return (
		<div className="bg-background w-full border-b">
			<ToolbarProvider editor={editor}>
				<ScrollArea className="h-fit py-0.5">
					<div className="flex w-max items-center gap-1 px-2">
						<ControlButton control={controls.undo} />
						<ControlButton control={controls.redo} />
						<GroupSeparator />

						<HeadingsToolbar />
						<GroupSeparator />

						<ControlButton control={controls.bold} />
						<ControlButton control={controls.italic} />
						<ControlButton control={controls.underline} />
						<ControlButton control={controls.strike} />
						<ControlButton control={controls.code} />
						<ColorHighlightToolbar />
						<GroupSeparator />

						<LinkToolbar />
						<GroupSeparator />

						<ControlButton control={controls.bulletList} />
						<ControlButton control={controls.orderedList} />
						<ControlButton control={controls.blockquote} />
						<GroupSeparator />

						<AlignmentToolbar />
						<GroupSeparator />

						<ControlButton control={controls.table} />
						<YoutubeToolbar />
						<ControlButton control={controls.horizontalRule} />
						<GroupSeparator />

						<ControlButton control={controls.clearFormatting} />
					</div>
					<ScrollBar orientation="horizontal" />
				</ScrollArea>
			</ToolbarProvider>
		</div>
	);
};
