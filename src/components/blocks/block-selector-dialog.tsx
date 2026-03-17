import { useQuery } from "@tanstack/react-query";
import { BookOpenIcon, SparklesIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	DialogSelect,
	DialogSelectContent,
	DialogSelectEmpty,
	DialogSelectItem,
	DialogSelectList,
	DialogSelectPagination,
	DialogSelectSearch,
} from "@/components/ui/composed/dialog-select";
import { orpc } from "@/lib/orpc/orpc";
import type { Block } from "@/lib/orpc/schemas/block";
import { cn } from "@/lib/utils";

const BLOCK_PAGE_SIZE = 12;

type SupportedBlockType = Extract<Block["type"], "template" | "database">;

const copyByType: Record<
	SupportedBlockType,
	{
		title: string;
		description: string;
		searchPlaceholder: string;
		empty: string;
	}
> = {
	template: {
		title: "Choose an AI Behavior",
		description: "Select a reusable behavior block to guide responses.",
		searchPlaceholder: "Search AI behaviors...",
		empty: "No AI behavior blocks found.",
	},
	database: {
		title: "Choose a Content Collection",
		description:
			"Select a reusable content collection block for retrieval-based answers.",
		searchPlaceholder: "Search content collections...",
		empty: "No content collection blocks found.",
	},
};

const iconByType: Record<SupportedBlockType, typeof SparklesIcon> = {
	template: SparklesIcon,
	database: BookOpenIcon,
};

const BlockSelectorDialog = ({
	open,
	onOpenChange,
	type,
	selectedIds = [],
	disabledIds = [],
	onSelect,
	title,
	description,
	searchPlaceholder,
	emptyText,
	className,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	type: SupportedBlockType;
	selectedIds?: string[];
	disabledIds?: string[];
	onSelect: (block: Block) => void | Promise<void>;
	title?: string;
	description?: string;
	searchPlaceholder?: string;
	emptyText?: string;
	className?: string;
}) => {
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(0);

	useEffect(() => {
		if (!open) {
			setSearch("");
			setPage(0);
		}
	}, [
		open,
	]);

	const blocksQuery = useQuery(
		orpc.block.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 200,
				filters: {
					type,
				},
			},
			enabled: open,
		}),
	);

	const blocks = blocksQuery.data?.data ?? [];

	const filteredBlocks = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) {
			return blocks;
		}
		return blocks.filter((block) => block.name.toLowerCase().includes(query));
	}, [
		blocks,
		search,
	]);

	const pageCount = Math.max(
		1,
		Math.ceil(filteredBlocks.length / BLOCK_PAGE_SIZE),
	);
	const currentPage = Math.min(page, pageCount - 1);
	const pagedBlocks = filteredBlocks.slice(
		currentPage * BLOCK_PAGE_SIZE,
		(currentPage + 1) * BLOCK_PAGE_SIZE,
	);
	const selectedSet = new Set(selectedIds);
	const disabledSet = new Set(disabledIds);
	const blockById = useMemo(
		() =>
			new Map(
				blocks.map((block) => [
					block.id,
					block,
				]),
			),
		[
			blocks,
		],
	);
	const Icon = iconByType[type];
	const copy = copyByType[type];

	return (
		<DialogSelect
			value={null}
			onValueChange={(blockId) => {
				const block = blockById.get(blockId ?? "");
				if (!block) {
					return;
				}
				Promise.resolve(onSelect(block)).catch(() => undefined);
			}}
			open={open}
			onOpenChange={onOpenChange}
		>
			<DialogSelectContent
				title={title ?? copy.title}
				className={cn("sm:max-w-3xl", className)}
			>
				<div>
					<div className="font-medium text-base">{title ?? copy.title}</div>
					<div className="text-muted-foreground text-sm">
						{description ?? copy.description}
					</div>
				</div>
				<DialogSelectSearch
					value={search}
					onValueChange={(value) => {
						setSearch(value);
						setPage(0);
					}}
					placeholder={searchPlaceholder ?? copy.searchPlaceholder}
				/>
				<DialogSelectList
					loading={blocksQuery.isLoading || blocksQuery.isFetching}
				>
					{pagedBlocks.map((block) => {
						const isSelected = selectedSet.has(block.id);
						const isDisabled = isSelected || disabledSet.has(block.id);

						return (
							<DialogSelectItem
								key={block.id}
								value={block.id}
								title={block.name}
								description={block.description || undefined}
								icon={<Icon className="size-4" />}
								disabled={isDisabled}
								trailing={
									isSelected ? (
										<span className="text-muted-foreground text-xs">Added</span>
									) : undefined
								}
							/>
						);
					})}
					{!blocksQuery.isLoading &&
						!blocksQuery.isFetching &&
						pagedBlocks.length === 0 && (
							<DialogSelectEmpty>{emptyText ?? copy.empty}</DialogSelectEmpty>
						)}
				</DialogSelectList>
				<DialogSelectPagination
					page={currentPage}
					pageCount={pageCount}
					onPageChange={setPage}
				/>
			</DialogSelectContent>
		</DialogSelect>
	);
};

export { BlockSelectorDialog };
