import "./tiptap.css";

import {
	type Content,
	type Editor,
	EditorContent,
	useEditor,
} from "@tiptap/react";
import { useEffect, useMemo } from "react";
import { BlockEditorPlaceholder } from "./block-editor-placeholder";
import { extensions } from "./extensions";
import { DefaultBubbleMenu } from "./menus/default-bubble-menu";
import { TableOptionsMenu } from "./menus/table-options-menu";
import { EditorToolbar } from "./toolbars/editor-toolbar";

interface BlockEditorProps {
	content?: Content;
	placeholder?: string;
	labelledBy?: string;
	describedBy?: string;
	onCreate?: (editor: Editor) => void;
	onUpdate?: (editor: Editor) => void;
}

// A bot without content stores `{}`, which is no document.
const isEmptyObject = (content?: Content) =>
	typeof content === "object" &&
	content !== null &&
	Object.keys(content).length === 0;

const BlockEditor = ({
	content,
	labelledBy,
	describedBy,
	onCreate,
	onUpdate,
}: BlockEditorProps) => {
	const attributes = useMemo(
		() => ({
			spellcheck: "false",
			...(labelledBy && {
				"aria-labelledby": labelledBy,
			}),
			...(describedBy && {
				"aria-describedby": describedBy,
			}),
		}),
		[
			labelledBy,
			describedBy,
		],
	);
	const editor = useEditor({
		extensions: [
			...extensions,
		],
		content: isEmptyObject(content) ? undefined : content,
		immediatelyRender: false,
		shouldRerenderOnTransaction: false,
		editorProps: {
			attributes,
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

	// An error shown later changes the description.
	useEffect(() => {
		editor?.setOptions({
			editorProps: {
				attributes,
			},
		});
	}, [
		editor,
		attributes,
	]);

	if (!editor) {
		return <BlockEditorPlaceholder />;
	}

	return (
		<div className="overflow-hidden rounded-md border">
			<DefaultBubbleMenu editor={editor} />
			<EditorToolbar editor={editor} />
			<EditorContent
				editor={editor}
				className="prose dark:prose-invert z-0 max-h-[50vh] max-w-full overflow-scroll focus:outline-none"
			/>
			<TableOptionsMenu editor={editor} />
		</div>
	);
};

export { BlockEditor, type BlockEditorProps };
