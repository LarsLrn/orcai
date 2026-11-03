import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { m } from "@/paraglide/messages";
import { controls, headingControls, runControl } from "../../controls";

const blockTypes = [
	controls.paragraph,
	headingControls[1],
	headingControls[2],
	headingControls[3],
	controls.bulletList,
	controls.orderedList,
	controls.blockquote,
];

export const NodeSelector = ({ editor }: { editor: Editor }) => {
	const active = useEditorState({
		editor,
		selector: ({ editor: current }) =>
			blockTypes.filter((blockType) => blockType.isActive?.(current)),
	});

	const name =
		active.length > 1
			? m.editor_node_selector_multiple_label()
			: (active[0] ?? controls.paragraph).label();

	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button variant="ghost" className="rounded-none">
						<span className="me-2 text-sm whitespace-nowrap">{name}</span>
						<ChevronDownIcon className="size-3" />
					</Button>
				}
			/>
			<PopoverContent className="w-48 p-1 shadow-xl" align="start">
				{blockTypes.map((blockType) => (
					<button
						type="button"
						key={blockType.label()}
						onClick={() => runControl(editor, blockType)}
						className="hover:bg-accent hover:text-accent-foreground flex cursor-pointer items-center rounded-md px-2 py-1.5 text-sm"
					>
						<blockType.icon className="me-2 size-3.5" />
						<span>{blockType.label()}</span>
						<div className="flex-1" />
						{active.includes(blockType) && (
							<CheckIcon className="ms-4 size-3.5" />
						)}
					</button>
				))}
			</PopoverContent>
		</Popover>
	);
};
