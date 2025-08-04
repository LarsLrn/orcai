import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { TagIcon } from "lucide-react";
import type { z } from "zod/v4";
import type { blockSelectSchema } from "@/lib/orpc/contracts/block";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { buttonVariants } from "../ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

type BlockFromAPI = z.infer<typeof blockSelectSchema>;

const BotBlocks = ({ blocks }: { blocks: BlockFromAPI[] }) => {
	const getBlockTypeColor = (type: string): string => {
		const typeColors: Record<string, string> = {
			prompt: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
			context:
				"bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
			memory:
				"bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
			tool: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
			output: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
		};
		return (
			typeColors[type] ||
			"bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
		);
	};

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
					<div className="grid gap-3 sm:grid-cols-2">
						{blocks.map((block) => (
							<Card key={block.id} className="border-border/50">
								<CardHeader className="pb-2">
									<div className="flex items-start justify-between">
										<div className="space-y-1">
											<CardTitle className="text-base">{block.name}</CardTitle>
											<Badge
												className={cn("text-xs", getBlockTypeColor(block.type))}
											>
												{block.type}
											</Badge>
										</div>
										<Tooltip>
											<TooltipTrigger asChild>
												<div className="text-muted-foreground text-xs">
													v{block.version}
												</div>
											</TooltipTrigger>
											<TooltipContent>
												<p>Block version {block.version}</p>
											</TooltipContent>
										</Tooltip>
									</div>
								</CardHeader>
								<CardContent className="pt-0">
									<div className="flex items-center justify-between text-muted-foreground text-xs">
										<span>
											Created{" "}
											{format(block.createdAt || new Date(), "MMM d, yyyy")}
										</span>
										<Link
											to="/app/blocks/$blockId"
											params={{ blockId: block.id }}
											className={buttonVariants({
												variant: "ghost",
												size: "sm",
												className: "h-6 px-2",
											})}
										>
											View
										</Link>
									</div>
								</CardContent>
							</Card>
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
