import { XIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { Block } from "@/lib/orpc/schemas/block";
import { cn } from "@/lib/utils";
import { DraggableBlock } from "./draggable-block";

interface BotBuilderActiveBlockItemProps {
	block: Block;
	onRemove: (blockId: string) => void;
}

const BotBuilderActiveBlockItem = ({
	block,
	onRemove,
}: BotBuilderActiveBlockItemProps) => {
	return (
		<div className="relative">
			<DraggableBlock block={block} />
			<button
				type="button"
				onClick={() => onRemove(block.id)}
				onMouseDown={(event) => event.stopPropagation()}
				className={cn(
					buttonVariants({ variant: "ghost", size: "icon" }),
					"absolute top-2 right-2 size-7 rounded-full border border-border/60 bg-background/90 shadow-sm hover:bg-destructive/10",
				)}
				aria-label={`Remove ${block.name}`}
			>
				<XIcon className="size-4" />
			</button>
		</div>
	);
};

export { BotBuilderActiveBlockItem };
