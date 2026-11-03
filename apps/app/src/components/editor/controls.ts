import {
	type ChainedCommands,
	type Editor,
	isiOS,
	isMacOS,
} from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	AlignRight,
	BoldIcon,
	Code2,
	Heading1,
	Heading2,
	Heading3,
	Heading4,
	ItalicIcon,
	LetterTextIcon,
	List,
	ListOrdered,
	type LucideIcon,
	Redo2,
	RemoveFormatting,
	SeparatorHorizontal,
	Strikethrough,
	Table,
	TextQuote,
	UnderlineIcon,
	Undo2,
} from "lucide-react";
import { m } from "@/paraglide/messages";

/** One editor action, rendered alike by the toolbar and the bubble menu. */
export type EditorControl = {
	label: () => string;
	icon: LucideIcon;
	/** Tiptap key notation, such as `Mod-Shift-s`. */
	shortcut?: string;
	command: (chain: ChainedCommands) => ChainedCommands;
	isActive?: (editor: Editor) => boolean;
	/** A condition on top of what the command allows. */
	isEnabled?: (editor: Editor) => boolean;
};

/** Marks stay off a selected formula, which the schema cannot refuse. */
export const outsideFormula = (editor: Editor) => !editor.isActive("math");

export type HeadingLevel = 1 | 2 | 3 | 4;

const headingControl = (
	level: HeadingLevel,
	icon: LucideIcon,
): EditorControl => ({
	label: () =>
		m.editor_control_heading({
			level,
		}),
	icon,
	command: (chain) =>
		chain.toggleHeading({
			level,
		}),
	isActive: (editor) =>
		editor.isActive("heading", {
			level,
		}),
});

export const headingControls: Record<HeadingLevel, EditorControl> = {
	1: headingControl(1, Heading1),
	2: headingControl(2, Heading2),
	3: headingControl(3, Heading3),
	4: headingControl(4, Heading4),
};

const NEW_TABLE = {
	rows: 3,
	cols: 3,
	withHeaderRow: true,
};

const alignControl = (
	textAlign: "left" | "center" | "right" | "justify",
	label: () => string,
	icon: LucideIcon,
): EditorControl => ({
	label,
	icon,
	command: (chain) => chain.setTextAlign(textAlign),
	isActive: (editor) =>
		editor.isActive({
			textAlign,
		}),
});

export const controls = {
	undo: {
		label: m.editor_control_undo,
		icon: Undo2,
		command: (chain) => chain.undo(),
	},
	redo: {
		label: m.editor_control_redo,
		icon: Redo2,
		command: (chain) => chain.redo(),
	},
	bold: {
		label: m.editor_control_bold,
		icon: BoldIcon,
		shortcut: "Mod-b",
		command: (chain) => chain.toggleBold(),
		isEnabled: outsideFormula,
		isActive: (editor) => editor.isActive("bold"),
	},
	italic: {
		label: m.editor_control_italic,
		icon: ItalicIcon,
		shortcut: "Mod-i",
		command: (chain) => chain.toggleItalic(),
		isEnabled: outsideFormula,
		isActive: (editor) => editor.isActive("italic"),
	},
	underline: {
		label: m.editor_control_underline,
		icon: UnderlineIcon,
		shortcut: "Mod-u",
		command: (chain) => chain.toggleUnderline(),
		isEnabled: outsideFormula,
		isActive: (editor) => editor.isActive("underline"),
	},
	strike: {
		label: m.editor_control_strike,
		icon: Strikethrough,
		shortcut: "Mod-Shift-s",
		command: (chain) => chain.toggleStrike(),
		isEnabled: outsideFormula,
		isActive: (editor) => editor.isActive("strike"),
	},
	code: {
		label: m.editor_control_code,
		icon: Code2,
		command: (chain) => chain.toggleCode(),
		isEnabled: outsideFormula,
		isActive: (editor) => editor.isActive("code"),
	},
	paragraph: {
		label: m.editor_control_paragraph,
		icon: LetterTextIcon,
		command: (chain) => chain.setParagraph(),
		isActive: (editor) =>
			editor.isActive("paragraph") &&
			!editor.isActive("bulletList") &&
			!editor.isActive("orderedList"),
	},
	bulletList: {
		label: m.editor_control_bullet_list,
		icon: List,
		command: (chain) => chain.toggleBulletList(),
		isActive: (editor) => editor.isActive("bulletList"),
	},
	orderedList: {
		label: m.editor_control_ordered_list,
		icon: ListOrdered,
		command: (chain) => chain.toggleOrderedList(),
		isActive: (editor) => editor.isActive("orderedList"),
	},
	blockquote: {
		label: m.editor_control_blockquote,
		icon: TextQuote,
		command: (chain) => chain.setParagraph().toggleBlockquote(),
		isActive: (editor) => editor.isActive("blockquote"),
	},
	alignLeft: alignControl("left", m.editor_control_align_left, AlignLeft),
	alignCentre: alignControl(
		"center",
		m.editor_control_align_centre,
		AlignCenter,
	),
	alignRight: alignControl("right", m.editor_control_align_right, AlignRight),
	alignJustify: alignControl(
		"justify",
		m.editor_control_align_justify,
		AlignJustify,
	),
	table: {
		label: m.editor_control_table,
		icon: Table,
		command: (chain) => chain.insertTable(NEW_TABLE),
	},
	horizontalRule: {
		label: m.editor_control_horizontal_rule,
		icon: SeparatorHorizontal,
		command: (chain) => chain.setHorizontalRule(),
	},
	clearFormatting: {
		label: m.editor_control_clear_formatting,
		icon: RemoveFormatting,
		command: (chain) => chain.unsetAllMarks().clearNodes(),
	},
} satisfies Record<string, EditorControl>;

export const runControl = (editor: Editor, control: EditorControl) =>
	control.command(editor.chain().focus()).run();

/** Whether the control is on and can run at the selection, and a way to run it. */
export const useControl = (editor: Editor, control: EditorControl) => {
	const state = useEditorState({
		editor,
		selector: ({ editor: current }) => ({
			isActive: control.isActive?.(current) ?? false,
			canRun:
				(control.isEnabled?.(current) ?? true) &&
				control.command(current.can().chain()).run(),
		}),
	});

	return {
		...state,
		run: () => runControl(editor, control),
	};
};

/** The first control that is on at the selection. */
export const useActiveControl = (
	editor: Editor,
	options: readonly EditorControl[],
) =>
	useEditorState({
		editor,
		selector: ({ editor: current }) =>
			options.find((option) => option.isActive?.(current)),
	});

/** A Tiptap shortcut as this platform's keyboard writes it, such as `⇧⌘S` or `Ctrl+Shift+S`. */
export const shortcutLabel = (shortcut: string) => {
	const keys = shortcut.split("-");
	const key = keys.at(-1)?.toUpperCase() ?? "";
	const shift = keys.includes("Shift");

	if (isMacOS() || isiOS()) {
		return `${shift ? "⇧" : ""}⌘${key}`;
	}
	return [
		m.editor_shortcut_ctrl(),
		...(shift
			? [
					m.editor_shortcut_shift(),
				]
			: []),
		key,
	].join("+");
};
