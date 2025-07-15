import {
	type Content,
	type Editor,
	EditorContent,
	useEditor,
} from "@tiptap/react";
import { defaultExtensions } from "./default-extensions";
import { DefaultBubbleMenu } from "./menus/default-bubble-menu";
import { TableOptionsMenu } from "./menus/table-options-menu";

interface BlockEditorProps {
	content?: Content;
	placeholder?: string;
	onCreate?: (editor: Editor) => void;
	onUpdate?: (editor: Editor) => void;
}

const BlockEditor = ({ content, onCreate, onUpdate }: BlockEditorProps) => {
	const editor = useEditor({
		extensions: [...defaultExtensions],
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

	return (
		<>
			<EditorContent
				editor={editor}
				className="prose dark:prose-invert z-0 max-w-full focus:outline-none"
			/>
			<TableOptionsMenu editor={editor} />
			<DefaultBubbleMenu editor={editor} />
		</>
	);
};

export { BlockEditor, type BlockEditorProps };
