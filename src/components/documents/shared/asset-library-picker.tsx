import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AssetCard } from "@/components/documents/asset-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orpc } from "@/lib/orpc/orpc";
import type { Asset } from "@/lib/orpc/schemas/asset";

const AssetLibraryPicker = ({
	selectedIds,
	onSelect,
}: {
	selectedIds: string[];
	onSelect: (asset: Asset) => void;
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
				placeholder="Search existing documents"
			/>

			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{assets.data?.data.map((asset) => {
					const isSelected = selectedIds.includes(asset.id);
					return (
						<div key={asset.id} className="space-y-2 rounded-2xl border p-3">
							<AssetCard asset={asset} />
							<Button
								className="w-full"
								variant={isSelected ? "secondary" : "outline"}
								disabled={isSelected}
								onClick={() => onSelect(asset)}
							>
								{isSelected ? "Added" : "Add Document"}
							</Button>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export { AssetLibraryPicker };
