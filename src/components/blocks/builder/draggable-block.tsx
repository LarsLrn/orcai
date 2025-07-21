import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Block } from "@/db/schema/block";
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
		<div
			ref={setNodeRef}
			style={style}
			{...listeners}
			{...attributes}
			className={cn(
				"cursor-grab rounded-lg border border-gray-300 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
				isDragging && "opacity-50",
			)}
		>
			<div className="font-medium text-gray-900">{block.name}</div>
			<div className="mt-1 text-gray-500 text-xs">Type: {block.type}</div>
		</div>
	);
};

export { DraggableBlock };
