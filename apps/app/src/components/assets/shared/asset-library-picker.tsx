import type { AssetWithCapabilities } from "@orcai/schema";
import { CompactAssetTile } from "@/components/assets/asset-tile";
import { LoadError } from "@/components/ui/composed/load-error";
import { SearchField } from "@/components/ui/composed/search-field";
import { Pager } from "@/components/ui/pager";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { usePickerList } from "@/hooks/use-picker-list";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const ASSET_PAGE_SIZE = 24;

const AssetLibraryPicker = ({
	selectedIds,
	onSelect,
	onDeselect,
	scrollAreaClassName,
}: {
	selectedIds: string[];
	onSelect: (asset: AssetWithCapabilities) => void;
	onDeselect?: (asset: AssetWithCapabilities) => void;
	scrollAreaClassName?: string;
}) => {
	const assets = usePickerList({
		pageSize: ASSET_PAGE_SIZE,
		queryOptions: ({ search, ...page }) =>
			orpc.asset.list.queryOptions({
				input: {
					...page,
					filters: {
						search,
						keptIn: "library",
					},
				},
			}),
	});

	return (
		<div className="space-y-4">
			<SearchField
				value={assets.search}
				onValueChange={assets.setSearch}
				placeholder={m.assets_library_picker_search_placeholder()}
			/>

			<ScrollArea
				className={cn("max-h-[50vh] overflow-y-auto", scrollAreaClassName)}
			>
				{assets.list.isError ? (
					<LoadError query={assets.list} />
				) : assets.loading ? (
					<Spinner className="mx-auto my-8 block size-6" />
				) : assets.rows.length === 0 ? (
					<p className="text-muted-foreground py-8 text-center text-sm">
						{m.assets_library_picker_empty_state()}
					</p>
				) : (
					<div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
						{assets.rows.map((asset) => {
							const isSelected = selectedIds.includes(asset.id);
							return (
								<CompactAssetTile
									key={asset.id}
									asset={asset}
									selection={{
										selected: isSelected,
										onToggle: () =>
											isSelected && onDeselect
												? onDeselect(asset)
												: onSelect(asset),
									}}
								/>
							);
						})}
					</div>
				)}
			</ScrollArea>
			<Pager variant="compact" {...assets.pager} />
		</div>
	);
};

export { AssetLibraryPicker };
