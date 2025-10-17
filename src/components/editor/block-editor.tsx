import "./tiptap.css";

import {
	type Content,
	type Editor,
	EditorContent,
	useEditor,
} from "@tiptap/react";
import { extensions } from "./extensions";
import { DefaultBubbleMenu } from "./menus/default-bubble-menu";
import { TableOptionsMenu } from "./menus/table-options-menu";
import { EditorToolbar } from "./toolbars/editor-toolbar";

interface BlockEditorProps {
	content?: Content;
	placeholder?: string;
	onCreate?: (editor: Editor) => void;
	onUpdate?: (editor: Editor) => void;
}

const BlockEditor = ({ content, onCreate, onUpdate }: BlockEditorProps) => {
	const editor = useEditor({
		extensions: [...extensions],
		content,
		immediatelyRender: false,
		shouldRerenderOnTransaction: false,
		editorProps: {
			attributes: {
				spellcheck: "false",
			},
		},
		onCreate: ({ editor }) => {
			onCreate?.(editor);
		},
		onUpdate: ({ editor }) => {
			onUpdate?.(editor);
		},
		onContentError: ({ error }) => {
			console.error(error);
		},
	});

	if (!editor) {
		return null;
	}

	return (
		<>
			<DefaultBubbleMenu editor={editor} />
			<EditorToolbar editor={editor} />
			<EditorContent
				editor={editor}
				className="prose dark:prose-invert z-0 max-w-full focus:outline-none"
			/>
			<TableOptionsMenu editor={editor} />
		</>
	);
};

export { BlockEditor, type BlockEditorProps };
