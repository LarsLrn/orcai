import { Link } from "@tanstack/react-router";
import { TagIcon } from "lucide-react";
import { BlockPreview } from "@/components/blocks/block-preview";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { Block } from "@/lib/orpc/schemas/block";

const BotBlocks = ({ blocks }: { blocks: Block[] }) => {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<TagIcon className="size-5" />
					Associated Blocks
					<Badge variant="secondary" className="ml-auto">
						{blocks?.length || 0}
					</Badge>
				</CardTitle>
				<CardDescription>
					Blocks that make up this bot's functionality
				</CardDescription>
			</CardHeader>
			<CardContent>
				{blocks && blocks.length > 0 ? (
					<div className="grid gap-3 sm:grid-cols-1">
						{blocks.map((block) => (
							<BlockPreview
								key={block.id}
								block={block}
								className="bg-muted/50"
							>
								<Link
									to="/app/blocks/$blockId"
									params={{ blockId: block.id }}
									className={buttonVariants({
										variant: "outline",
										size: "sm",
										className: "h-6 px-2",
									})}
								>
									View
								</Link>
							</BlockPreview>
						))}
					</div>
				) : (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<TagIcon className="mb-2 size-8 text-muted-foreground" />
						<p className="text-muted-foreground">No blocks associated</p>
						<p className="text-muted-foreground text-sm">
							Add blocks to enhance this bot's capabilities
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
};

export { BotBlocks };
