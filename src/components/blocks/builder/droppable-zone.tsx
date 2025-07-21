import { type UniqueIdentifier, useDroppable } from "@dnd-kit/core";
import { DropletIcon } from "lucide-react";
import type React from "react";
import { cn } from "@/lib/utils";

interface Props {
	children: React.ReactNode;
	dragging: boolean;
	id: UniqueIdentifier;
}

const DroppableZone = ({ children, id, dragging }: Props) => {
	const { isOver, setNodeRef } = useDroppable({
		id,
	});

	return (
		<div
			ref={setNodeRef}
			className={cn(
				"min-h-[200px] rounded-lg border-2 border-dashed p-4 transition-colors",
				isOver && "border-green-500 bg-green-50",
				dragging && !children && "border-blue-500 bg-blue-50",
				children && "min-h-fit border-gray-300 bg-white",
				!children && !dragging && "border-gray-200 bg-gray-50",
			)}
		>
			{children || (
				<div className="flex h-full items-center justify-center text-gray-400">
					<div className="text-center">
						<DropletIcon className="mx-auto mb-2 h-8 w-8" />
						<p className="text-sm">Drop blocks here to activate them</p>
					</div>
				</div>
			)}
		</div>
	);
};

export { DroppableZone };
