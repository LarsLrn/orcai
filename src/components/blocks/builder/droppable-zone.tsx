import { type UniqueIdentifier, useDroppable } from "@dnd-kit/core";
import { DropletIcon } from "lucide-react";
import type React from "react";
import { cn } from "@/lib/utils";

interface Props {
	children?: React.ReactNode;
	className?: string;
	dragging: boolean;
	id: UniqueIdentifier;
	emptyContent?: React.ReactNode;
	isEmpty?: boolean;
}

const DroppableZone = ({
	children,
	id,
	dragging,
	className,
	emptyContent,
	isEmpty,
}: Props) => {
	const { isOver, setNodeRef } = useDroppable({
		id,
	});

	const showEmptyState = typeof isEmpty === "boolean" ? isEmpty : !children;
	const content = showEmptyState
		? emptyContent || (
				<div className="flex h-full items-center justify-center text-muted-foreground">
					<div className="text-center">
						<DropletIcon className="mx-auto mb-2 h-8 w-8 opacity-60" />
						<p className="text-sm">Drop blocks here to activate them</p>
					</div>
				</div>
			)
		: children;

	return (
		<div
			ref={setNodeRef}
			className={cn(
				"min-h-[200px] rounded-lg border-2 border-dashed bg-muted/40 p-4 transition-colors dark:bg-muted/10",
				isOver && "border-primary bg-primary/10 dark:bg-primary/20",
				dragging && showEmptyState && "border-primary/60",
				!showEmptyState && "min-h-fit border-border bg-card shadow-sm",
				showEmptyState && !isOver && !dragging && "border-border/60",
				className,
			)}
		>
			{content}
		</div>
	);
};

export { DroppableZone };
