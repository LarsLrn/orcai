import "./tiptap.css";

import { ORGANIZATION_DESCRIPTION_HEADING_LEVELS } from "@orcai/schema";
import {
	type Content,
	type Editor,
	EditorContent,
	useEditor,
} from "@tiptap/react";
import { useEffect } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DescriptionEditorPlaceholder } from "./description-editor-placeholder";
import { descriptionExtensions } from "./extensions";
import { BlockquoteToolbar } from "./toolbars/blockquote";
import { BoldToolbar } from "./toolbars/bold";
import { BulletListToolbar } from "./toolbars/bullet-list";
import { HeadingsToolbar } from "./toolbars/headings";
import { ItalicToolbar } from "./toolbars/italic";
import { LinkToolbar } from "./toolbars/link";
import { OrderedListToolbar } from "./toolbars/ordered-list";
import { RedoToolbar } from "./toolbars/redo";
import { ToolbarProvider } from "./toolbars/toolbar-provider";
import { UndoToolbar } from "./toolbars/undo";

type DescriptionEditorProps = {
	content: Content | null;
	labelledBy?: string;
	describedBy?: string;
	invalid?: boolean;
	onUpdate: (editor: Editor) => void;
	onBlur?: () => void;
};

const editorAttributes = ({
	labelledBy,
	describedBy,
	invalid,
}: Pick<
	DescriptionEditorProps,
	"labelledBy" | "describedBy" | "invalid"
>): Record<string, string> => ({
	role: "textbox",
	"aria-multiline": "true",
	...(labelledBy && {
		"aria-labelledby": labelledBy,
	}),
	...(describedBy && {
		"aria-describedby": describedBy,
	}),
	...(invalid && {
		"aria-invalid": "true",
	}),
});

/** An editor for short rich text: headings, lists, quotes and links. */
const DescriptionEditor = ({
	content,
	labelledBy,
	describedBy,
	invalid,
	onUpdate,
	onBlur,
}: DescriptionEditorProps) => {
	const editor = useEditor({
		extensions: descriptionExtensions,
		content: content ?? undefined,
		immediatelyRender: false,
		shouldRerenderOnTransaction: false,
		editorProps: {
			attributes: editorAttributes({
				labelledBy,
				describedBy,
				invalid,
			}),
		},
		onUpdate: ({ editor }) => onUpdate(editor),
		onBlur: () => onBlur?.(),
	});
	useEffect(() => {
		editor?.setOptions({
			editorProps: {
				attributes: editorAttributes({
					labelledBy,
					describedBy,
					invalid,
				}),
			},
		});
	}, [
		editor,
		labelledBy,
		describedBy,
		invalid,
	]);

	if (!editor) {
		return <DescriptionEditorPlaceholder />;
	}

	return (
		<div
			data-invalid={invalid || undefined}
			className="overflow-hidden rounded-2xl border border-transparent bg-input/50 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 data-invalid:border-destructive data-invalid:ring-3 data-invalid:ring-destructive/20"
		>
			<ToolbarProvider editor={editor}>
				<ScrollArea className="border-border/60 border-b">
					<div className="flex items-center gap-1 px-2 py-0.5">
						<UndoToolbar />
						<RedoToolbar />
						<Separator orientation="vertical" className="mx-1 h-7" />
						<HeadingsToolbar levels={ORGANIZATION_DESCRIPTION_HEADING_LEVELS} />
						<BoldToolbar />
						<ItalicToolbar />
						<LinkToolbar />
						<Separator orientation="vertical" className="mx-1 h-7" />
						<BulletListToolbar />
						<OrderedListToolbar />
						<BlockquoteToolbar />
					</div>
					<ScrollBar orientation="horizontal" />
				</ScrollArea>
			</ToolbarProvider>
			<EditorContent
				editor={editor}
				className="description-editor prose prose-sm dark:prose-invert prose-li:my-1 max-h-[50vh] max-w-none overflow-y-auto prose-headings:font-heading prose-headings:font-semibold prose-h3:text-base text-base md:text-sm [&_li>p]:my-0"
			/>
		</div>
	);
};

export { DescriptionEditor };
