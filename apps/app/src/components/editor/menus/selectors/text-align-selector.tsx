import type { Editor } from "@tiptap/core";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { m } from "@/paraglide/messages";
import { controls, runControl, useActiveControl } from "../../controls";

const alignments = [
	controls.alignLeft,
	controls.alignCentre,
	controls.alignRight,
];

export const TextAlignSelector = ({ editor }: { editor: Editor }) => {
	const active = useActiveControl(editor, alignments) ?? controls.alignLeft;

	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						variant="ghost"
						className="rounded-none"
						aria-label={m.editor_toolbar_alignment_tooltip()}
					>
						<active.icon className="me-2 size-4" strokeWidth={2.5} />
						<ChevronDownIcon className="size-3" />
					</Button>
				}
			/>
			<PopoverContent className="w-32 p-1 shadow-xl" align="end">
				{alignments.map((alignment) => (
					<button
						type="button"
						key={alignment.label()}
						onClick={() => runControl(editor, alignment)}
						className="hover:bg-accent hover:text-accent-foreground flex items-center space-x-2 rounded-md px-2 py-1.5"
					>
						<alignment.icon className="size-4" />
						<span className="text-sm">{alignment.label()}</span>
						<div className="flex-1" />
						{alignment === active && <CheckIcon className="size-3.5" />}
					</button>
				))}
			</PopoverContent>
		</Popover>
	);
};
