import type { AssetId } from "@orcai/core";
import type { Asset } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import convert from "convert";
import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import { StatePagination } from "@/components/blocks/state-pagination";
import { Placeholder } from "@/components/placeholders/placeholder";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc/orpc";

const PAGE_SIZE = 20;

export const ChatAssetPicker = ({
	open,
	onOpenChange,
	selectedAssetIds,
	onAddAsset,
	onRemoveAsset,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedAssetIds: Set<AssetId>;
	onAddAsset: (asset: Asset) => void;
	onRemoveAsset: (assetId: AssetId) => void;
}) => {
	const [search, setSearch] = useState("");
	const [debouncedSearch] = useDebounceValue(search, 500);
	const [pageIndex, setPageIndex] = useState(0);

	const { data: assets, isPending } = useQuery(
		orpc.asset.list.queryOptions({
			input: {
				pageIndex,
				pageSize: PAGE_SIZE,
				filters: {
					search: debouncedSearch,
				},
			},
		}),
	);

	const maxPage = Math.max(1, Math.ceil((assets?.rowCount ?? 0) / PAGE_SIZE));

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Select Existing Assets</DialogTitle>
					<DialogDescription>
						Attach files from your asset library to this chat message.
					</DialogDescription>
				</DialogHeader>

				<div className="relative">
					<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						className="pl-9"
						placeholder="Search by title..."
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
				</div>

				<ScrollArea className="h-72 rounded-md border">
					<div className="divide-y">
						{isPending && <Spinner className="mt-10 size-10 w-full" />}
						{!isPending && assets?.data.length === 0 && (
							<Placeholder
								title="Not found"
								description="No matching assets available."
							/>
						)}
						{assets?.data.map((asset) => (
							<div
								key={asset.id}
								className="flex items-center justify-between gap-3 p-3"
							>
								<div className="min-w-0">
									<div className="truncate font-medium text-sm">
										{asset.title}
									</div>
									<div className="truncate text-muted-foreground text-xs">
										{asset.fileType} ·{" "}
										{convert(asset.size, "B").to("best").toString(2)}
									</div>
								</div>
								{selectedAssetIds.has(asset.id) ? (
									<Button
										size="sm"
										type="button"
										variant="destructive"
										onClick={() => onRemoveAsset(asset.id)}
									>
										Remove
									</Button>
								) : (
									<Button
										size="sm"
										type="button"
										onClick={() => onAddAsset(asset)}
									>
										Attach
									</Button>
								)}
							</div>
						))}
					</div>
				</ScrollArea>

				<DialogFooter>
					<StatePagination
						maxPages={maxPage}
						page={pageIndex}
						onPageChange={setPageIndex}
					/>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
