import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
	CheckIcon,
	ChevronDownIcon,
	Heading1,
	Heading2,
	Heading3,
	LetterTextIcon,
	List,
	ListOrdered,
	type LucideIcon,
	QuoteIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { m } from "@/paraglide/messages";

interface SelectorResult {
	isParagraph: boolean;
	isHeading1: boolean;
	isHeading2: boolean;
	isHeading3: boolean;
	isBulletList: boolean;
	isOrderedList: boolean;
	isBlockquote: boolean;
}

interface MenuItem {
	name: string;
	icon: LucideIcon;
	onClick: (editor: Editor) => void;
	isActive: (state: SelectorResult) => boolean;
}

const menuItems = (): MenuItem[] => [
	{
		name: m.editor_node_selector_text_option(),
		icon: LetterTextIcon,
		onClick: (editor) =>
			editor.chain().focus().toggleNode("paragraph", "paragraph").run(),
		isActive: (state) =>
			state.isParagraph && !state.isBulletList && !state.isOrderedList,
	},
	{
		name: m.editor_node_selector_heading_1_option(),
		icon: Heading1,
		onClick: (editor) =>
			editor
				.chain()
				.focus()
				.toggleHeading({
					level: 1,
				})
				.run(),
		isActive: (state) => state.isHeading1,
	},
	{
		name: m.editor_node_selector_heading_2_option(),
		icon: Heading2,
		onClick: (editor) =>
			editor
				.chain()
				.focus()
				.toggleHeading({
					level: 2,
				})
				.run(),
		isActive: (state) => state.isHeading2,
	},
	{
		name: m.editor_node_selector_heading_3_option(),
		icon: Heading3,
		onClick: (editor) =>
			editor
				.chain()
				.focus()
				.toggleHeading({
					level: 3,
				})
				.run(),
		isActive: (state) => state.isHeading3,
	},
	// {
	//   name: "To-do List",
	//   icon: CheckSquare,
	//   onClick: (editor) => editor!.chain().focus().toggleTaskList().run(),
	//   isActive: (editor) => editor!.isActive("taskItem"),
	// },
	{
		name: m.editor_node_selector_bullet_list_option(),
		icon: List,
		onClick: (editor) => editor.chain().focus().toggleBulletList().run(),
		isActive: (state) => state.isBulletList,
	},
	{
		name: m.editor_node_selector_numbered_list_option(),
		icon: ListOrdered,
		onClick: (editor) => editor.chain().focus().toggleOrderedList().run(),
		isActive: (state) => state.isOrderedList,
	},
	{
		name: m.editor_node_selector_quote_option(),
		icon: QuoteIcon,
		onClick: (editor) =>
			editor
				.chain()
				.focus()
				.toggleNode("paragraph", "paragraph")
				.toggleBlockquote()
				.run(),
		isActive: (state) => state.isBlockquote,
	},
	// {
	//   name: "Code",
	//   icon: Code,
	//   onClick: (editor) => editor.chain().focus().toggleCode().run(),
	//   isActive: (state) => state.isCode,
	// },
];

export const NodeSelector = ({ editor }: { editor: Editor }) => {
	const editorState = useEditorState<SelectorResult>({
		editor,
		selector: (instance) => ({
			isParagraph: instance.editor.isActive("paragraph"),
			isHeading1: instance.editor.isActive("heading", {
				level: 1,
			}),
			isHeading2: instance.editor.isActive("heading", {
				level: 2,
			}),
			isHeading3: instance.editor.isActive("heading", {
				level: 3,
			}),
			isBulletList: instance.editor.isActive("bulletList"),
			isOrderedList: instance.editor.isActive("orderedList"),
			isBlockquote: instance.editor.isActive("blockquote"),
		}),
	});

	const items = menuItems();
	const activeItems = items.filter((item) => item.isActive(editorState));

	const name =
		activeItems.length > 1
			? m.editor_node_selector_multiple_label()
			: (activeItems.pop()?.name ?? m.editor_node_selector_text_option());

	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button variant="ghost" className="rounded-none">
						<span className="me-2 whitespace-nowrap text-sm">{name}</span>
						<ChevronDownIcon className="size-3" />
					</Button>
				}
			/>
			<PopoverContent className="w-48 p-1 shadow-xl" align="start">
				{items.map((item) => {
					return (
						<button
							type="button"
							key={item.name}
							onClick={() => item.onClick(editor)}
							className="flex cursor-pointer items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
						>
							<item.icon className="me-2 size-3.5" />
							<span>{item.name}</span>
							<div className="flex-1" />
							{item.isActive(editorState) && (
								<CheckIcon className="ms-4 size-3.5" />
							)}
						</button>
					);
				})}
			</PopoverContent>
		</Popover>
	);
};
