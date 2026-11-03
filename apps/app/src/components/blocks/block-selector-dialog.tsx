import type { BlockId } from "@orcai/core";
import type { Block, BlockType } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { BookOpenIcon, SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DialogSelect,
	DialogSelectContent,
	DialogSelectEmpty,
	DialogSelectItem,
	DialogSelectList,
	DialogSelectPagination,
	DialogSelectSearch,
} from "@/components/ui/composed/dialog-select";
import { describeError } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import {
	getPublicationStatusLabel,
	getPublicationStatusVariant,
} from "@/lib/presentation/publication-status";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const BLOCK_PAGE_SIZE = 12;

const getCopy = (type: BlockType) =>
	type === "behaviour"
		? {
				title: m.blocks_selector_dialog_behaviour_title(),
				description: m.blocks_selector_dialog_behaviour_description(),
				searchPlaceholder:
					m.blocks_selector_dialog_behaviour_search_placeholder(),
				empty: m.blocks_selector_dialog_behaviour_empty_state_title(),
			}
		: {
				title: m.blocks_selector_dialog_repository_title(),
				description: m.blocks_selector_dialog_repository_description(),
				searchPlaceholder:
					m.blocks_selector_dialog_repository_search_placeholder(),
				empty: m.blocks_selector_dialog_repository_empty_state_title(),
			};

const iconByType: Record<BlockType, typeof SparklesIcon> = {
	behaviour: SparklesIcon,
	repository: BookOpenIcon,
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
	emptyText,
	className,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	type: BlockType;
	selectedIds?: BlockId[];
	disabledIds?: BlockId[];
	includeDrafts?: boolean;
	onSelect: (block: Block) => void | Promise<void>;
	title?: string;
	description?: string;
	emptyText?: string;
	className?: string;
}) => {
	const [search, setSearch] = useState("");
	const [debouncedSearch] = useDebounceValue(search, 300);
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
				pageIndex: page,
				pageSize: BLOCK_PAGE_SIZE,
				filters: {
					type,
					status: includeDrafts ? "all" : "ready",
					search: debouncedSearch.trim() || undefined,
				},
			},
			enabled: open,
		}),
	);

	const blocks = blocksQuery.isError ? [] : (blocksQuery.data?.data ?? []);
	const pageCount = Math.ceil(
		(blocksQuery.data?.rowCount ?? 0) / BLOCK_PAGE_SIZE,
	);
	const selectedSet = new Set(selectedIds);
	const disabledSet = new Set(disabledIds);
	const Icon = iconByType[type];
	const copy = getCopy(type);

	return (
		<DialogSelect
			value={null}
			onValueChange={(blockId) => {
				const block = blocks.find((entry) => entry.id === blockId);
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
					<div className="text-base font-medium">{title ?? copy.title}</div>
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
					placeholder={copy.searchPlaceholder}
				/>
				<DialogSelectList
					loading={blocksQuery.isLoading || blocksQuery.isFetching}
				>
					{blocks.map((block) => {
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
												variant={getPublicationStatusVariant(block.status)}
												className="h-5 px-1.5"
											>
												{getPublicationStatusLabel(block.status)}
											</Badge>
										) : null}
										{isSelected ? (
											<span className="text-muted-foreground text-xs">
												{m.blocks_selector_dialog_added_label()}
											</span>
										) : null}
									</div>
								}
							/>
						);
					})}
					{blocksQuery.isError ? (
						<DialogSelectEmpty role="alert">
							{describeError(blocksQuery.error)}
							<Button
								variant="outline"
								size="sm"
								className="mt-3"
								onClick={() => void blocksQuery.refetch()}
							>
								{m.common_retry_button()}
							</Button>
						</DialogSelectEmpty>
					) : (
						blocks.length === 0 && (
							<DialogSelectEmpty>{emptyText ?? copy.empty}</DialogSelectEmpty>
						)
					)}
				</DialogSelectList>
				<DialogSelectPagination
					page={page}
					pageCount={pageCount}
					onPageChange={setPage}
				/>
			</DialogSelectContent>
		</DialogSelect>
	);
};

export { BlockSelectorDialog };
