import type { BlockId } from "@orcai/core";
import type { BlockListItem, BlockType } from "@orcai/schema";
import { BookOpenIcon, SparklesIcon } from "lucide-react";
import {
	DialogSelect,
	DialogSelectContent,
	DialogSelectEmpty,
	DialogSelectItem,
	DialogSelectList,
} from "@/components/ui/composed/dialog-select";
import { LoadError } from "@/components/ui/composed/load-error";
import { SearchField } from "@/components/ui/composed/search-field";
import { StateBadge } from "@/components/ui/composed/state-badge";
import { Pager } from "@/components/ui/pager";
import { usePickerList } from "@/hooks/use-picker-list";
import { orpc } from "@/lib/orpc/orpc";
import { publicationStatusBadge } from "@/lib/presentation/publication-status";
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
	onSelect: (block: BlockListItem) => void | Promise<void>;
	title?: string;
	description?: string;
	emptyText?: string;
	className?: string;
}) => {
	const blocks = usePickerList({
		pageSize: BLOCK_PAGE_SIZE,
		open,
		queryOptions: ({ search, ...page }) =>
			orpc.block.list.queryOptions({
				input: {
					...page,
					filters: {
						type,
						status: includeDrafts ? "all" : "ready",
						search,
					},
				},
			}),
	});
	const selectedSet = new Set(selectedIds);
	const disabledSet = new Set(disabledIds);
	const Icon = iconByType[type];
	const copy = getCopy(type);

	return (
		<DialogSelect
			value={null}
			onValueChange={(blockId) => {
				const block = blocks.rows.find((entry) => entry.id === blockId);
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
				<SearchField
					value={blocks.search}
					onValueChange={blocks.setSearch}
					placeholder={copy.searchPlaceholder}
				/>
				<DialogSelectList loading={blocks.loading}>
					{blocks.rows.map((block) => {
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
											<StateBadge
												badge={publicationStatusBadge(block.status)}
												className="h-5 px-1.5"
											/>
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
					{blocks.list.isError ? (
						<LoadError query={blocks.list} />
					) : (
						blocks.rows.length === 0 && (
							<DialogSelectEmpty>{emptyText ?? copy.empty}</DialogSelectEmpty>
						)
					)}
				</DialogSelectList>
				<Pager variant="compact" {...blocks.pager} />
			</DialogSelectContent>
		</DialogSelect>
	);
};

export { BlockSelectorDialog };
