import type { Editor } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { controls, type EditorControl, useControl } from "../../controls";
import { LinkSelector } from "./link-selector";

const marks = [
	controls.bold,
	controls.italic,
	controls.underline,
	controls.strike,
	controls.code,
];

const MarkButton = ({
	editor,
	control,
}: {
	editor: Editor;
	control: EditorControl;
}) => {
	const { isActive, canRun, run } = useControl(editor, control);

	return (
		<Button
			variant="ghost"
			size="icon"
			aria-label={control.label()}
			aria-pressed={isActive}
			disabled={!canRun}
			className="shrink-0 rounded-none"
			onClick={run}
		>
			<control.icon
				className={cn("size-4", isActive && "text-primary")}
				strokeWidth={2.5}
			/>
		</Button>
	);
};

export const TextButtons = ({ editor }: { editor: Editor }) => (
	<>
		{marks.map((control) => (
			<MarkButton key={control.label()} editor={editor} control={control} />
		))}
		<LinkSelector editor={editor} />
	</>
);
