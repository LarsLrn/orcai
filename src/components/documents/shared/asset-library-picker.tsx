import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AssetCard } from "@/components/documents/asset-card";
import { Input } from "@/components/ui/input";
import { orpc } from "@/lib/orpc/orpc";
import type { Asset } from "@/lib/orpc/schemas/asset";
import { cn } from "@/lib/utils";

const AssetLibraryPicker = ({
	selectedIds,
	onSelect,
	onDeselect,
}: {
	selectedIds: string[];
	onSelect: (asset: Asset) => void;
	onDeselect?: (asset: Asset) => void;
}) => {
	const [search, setSearch] = useState("");
	const assets = useQuery(
		orpc.asset.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 24,
				filters: {
					search: search.trim() || undefined,
				},
			},
		}),
	);

	return (
		<div className="space-y-4">
			<Input
				value={search}
				onChange={(event) => setSearch(event.target.value)}
				placeholder="Search the content library"
			/>

			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{assets.data?.data.map((asset) => {
					const isSelected = selectedIds.includes(asset.id);
					return (
						<div key={asset.id}>
							<AssetCard
								asset={asset}
								actions={{
									primary: {
										onClick: () =>
											isSelected && onDeselect
												? onDeselect(asset)
												: onSelect(asset),
									},
									footer: [],
								}}
								className={cn(
									"",
									isSelected &&
										"bg-primary/10 data-[state=active]:bg-primary/20",
								)}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export { AssetLibraryPicker };
