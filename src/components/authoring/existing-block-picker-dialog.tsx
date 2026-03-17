import { useQuery } from "@tanstack/react-query";
import { BookOpenIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { orpc } from "@/lib/orpc/orpc";
import type { Block } from "@/lib/orpc/schemas/block";
import { isDatabaseBlock, isTemplateBlock } from "@/lib/orpc/schemas/block";

const ExistingBlockPickerDialog = ({
	open,
	onOpenChange,
	type,
	selectedIds,
	onSelect,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	type: "template" | "database";
	selectedIds: string[];
	onSelect: (block: Block) => void | Promise<void>;
}) => {
	const [search, setSearch] = useState("");
	const blocksQuery = useQuery(
		orpc.block.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 100,
			},
			enabled: open,
		}),
	);

	const filteredBlocks = useMemo(() => {
		const blocks = blocksQuery.data?.data ?? [];
		const typedBlocks = blocks.filter((block) =>
			type === "template" ? isTemplateBlock(block) : isDatabaseBlock(block),
		);
		const query = search.trim().toLowerCase();

		if (!query) {
			return typedBlocks;
		}

		return typedBlocks.filter((block) =>
			block.name.toLowerCase().includes(query),
		);
	}, [
		blocksQuery.data?.data,
		search,
		type,
	]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[88vh] overflow-auto sm:max-w-5xl">
				<DialogHeader>
					<DialogTitle>
						{type === "template"
							? "Use Existing AI Behavior"
							: "Use Existing Content Collection"}
					</DialogTitle>
					<DialogDescription>
						{type === "template"
							? "Attach a reusable AI behavior block instead of creating a new one."
							: "Attach a reusable content collection to this bot."}
					</DialogDescription>
				</DialogHeader>

				<div className="relative">
					<SearchIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder={
							type === "template"
								? "Search AI behavior blocks"
								: "Search content collections"
						}
						className="pl-9"
					/>
				</div>

				{filteredBlocks.length === 0 ? (
					<Empty className="rounded-2xl border">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								{type === "template" ? (
									<SparklesIcon className="h-5 w-5" />
								) : (
									<BookOpenIcon className="h-5 w-5" />
								)}
							</EmptyMedia>
							<EmptyTitle>No matching blocks</EmptyTitle>
							<EmptyDescription>
								Adjust the search or create a new{" "}
								{type === "template" ? "AI behavior" : "content collection"}{" "}
								instead.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<div className="grid gap-3 md:grid-cols-2">
						{filteredBlocks.map((block) => {
							const isSelected = selectedIds.includes(block.id);
							return (
								<div
									key={block.id}
									className="rounded-2xl border bg-background p-4 shadow-sm"
								>
									<div className="flex items-start justify-between gap-3">
										<div>
											<div className="font-medium">{block.name}</div>
											<div className="mt-2 flex flex-wrap gap-2">
												<Badge variant="outline">v{block.version}</Badge>
												{isTemplateBlock(block) ? (
													<>
														<Badge variant="secondary">
															{block.config.provider || "No provider"}
														</Badge>
														<Badge variant="secondary">
															{block.config.model || "No model"}
														</Badge>
													</>
												) : isDatabaseBlock(block) ? (
													<>
														<Badge variant="secondary">
															{block.config.provider || "No provider"}
														</Badge>
														<Badge variant="secondary">
															{block.config.embeddingModel ||
																"No embedding model"}
														</Badge>
													</>
												) : null}
											</div>
										</div>
										<Button
											variant={isSelected ? "secondary" : "outline"}
											disabled={isSelected}
											onClick={async () => {
												await onSelect(block);
												onOpenChange(false);
											}}
										>
											{isSelected ? "Added" : "Use Block"}
										</Button>
									</div>
								</div>
							);
						})}
					</div>
				)}

				<DialogFooter showCloseButton />
			</DialogContent>
		</Dialog>
	);
};

export { ExistingBlockPickerDialog };
