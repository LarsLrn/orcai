import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { BlockPreview } from "@/components/blocks/block-preview";
import type { Block } from "@/lib/orpc/schemas/block";
import { cn } from "@/lib/utils";

const DraggableBlock = ({ block }: { block: Block }) => {
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useDraggable({
			id: block.id,
		});

	const style = {
		transform: CSS.Translate.toString(transform),
	};

	return (
		<div ref={setNodeRef} style={style} {...listeners} {...attributes}>
			<BlockPreview
				block={block}
				className={cn(
					isDragging &&
						"border-primary/60 shadow-lg ring-2 ring-primary/30 dark:ring-primary/40",
				)}
			/>
		</div>
	);
};

export { DraggableBlock };
