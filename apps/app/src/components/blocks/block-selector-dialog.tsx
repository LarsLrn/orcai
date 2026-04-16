import type { BlockId } from "@orcai/core";
import { useQuery } from "@tanstack/react-query";
import { BookOpenIcon, SparklesIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
		title: "Choose an AI Behaviour",
		description: "Select a reusable behaviour block to guide responses.",
		searchPlaceholder: "Search AI behaviours...",
		empty: "No AI behaviour blocks found.",
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
	includeDrafts = false,
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
	selectedIds?: Block["id"][];
	disabledIds?: Block["id"][];
	includeDrafts?: boolean;
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

	const readyBlocksQuery = useQuery(
		orpc.block.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 200,
				filters: {
					type,
					status: "ready",
				},
			},
			enabled: open,
		}),
	);

	const draftBlocksQuery = useQuery(
		orpc.block.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 200,
				filters: {
					type,
					status: "draft",
				},
			},
			enabled: open && includeDrafts,
		}),
	);

	const readyBlocks = readyBlocksQuery.data?.data ?? [];
	const draftBlocks = includeDrafts ? (draftBlocksQuery.data?.data ?? []) : [];
	const blocks = useMemo(() => {
		if (!includeDrafts) {
			return readyBlocks;
		}

		const seen = new Set<string>();
		const merged: Block[] = [];

		for (const block of [
			...readyBlocks,
			...draftBlocks,
		]) {
			if (!seen.has(block.id)) {
				seen.add(block.id);
				merged.push(block);
			}
		}

		return merged;
	}, [
		draftBlocks,
		includeDrafts,
		readyBlocks,
	]);

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
				const block = blockById.get((blockId as BlockId) ?? "");
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
					loading={
						readyBlocksQuery.isLoading ||
						readyBlocksQuery.isFetching ||
						(includeDrafts &&
							(draftBlocksQuery.isLoading || draftBlocksQuery.isFetching))
					}
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
									<div className="flex items-center gap-2">
										{block.status === "draft" ? (
											<Badge
												variant="destructive"
												className="h-5 px-1.5 text-[10px]"
											>
												Draft
											</Badge>
										) : null}
										{isSelected ? (
											<span className="text-muted-foreground text-xs">
												Added
											</span>
										) : null}
									</div>
								}
							/>
						);
					})}
					{!readyBlocksQuery.isLoading &&
						!readyBlocksQuery.isFetching &&
						(!includeDrafts ||
							(!draftBlocksQuery.isLoading && !draftBlocksQuery.isFetching)) &&
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
