import type { AssetWithCapabilities } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import { CompactAssetTile } from "@/components/documents/asset-tile";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

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
	const [search, setSearch] = useState("");
	const [debouncedSearch] = useDebounceValue(search, 300);
	const assets = useQuery(
		orpc.asset.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 24,
				filters: {
					search: debouncedSearch.trim() || undefined,
					origin: "library",
				},
			},
		}),
	);

	return (
		<div className="space-y-4">
			<Input
				value={search}
				onChange={(event) => setSearch(event.target.value)}
				placeholder={m.assets_library_picker_search_placeholder()}
			/>

			<ScrollArea
				className={cn("max-h-[50vh] overflow-y-auto", scrollAreaClassName)}
			>
				<div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
					{assets.data?.data.map((asset) => {
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
			</ScrollArea>
		</div>
	);
};

export { AssetLibraryPicker };
