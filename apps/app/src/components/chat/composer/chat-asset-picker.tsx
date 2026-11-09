import type { AssetId } from "@orcai/core";
import type { Asset } from "@orcai/schema";
import { Placeholder } from "@/components/placeholders/placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/ui/composed/load-error";
import { SearchField } from "@/components/ui/composed/search-field";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Pager } from "@/components/ui/pager";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { usePickerList } from "@/hooks/use-picker-list";
import { getFileTypeLabel } from "@/lib/labels/file-type";
import { formatFileSize } from "@/lib/locale/format-file-size";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

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
	const assets = usePickerList({
		pageSize: PAGE_SIZE,
		open,
		queryOptions: ({ search, ...page }) =>
			orpc.asset.list.queryOptions({
				input: {
					...page,
					filters: {
						search,
					},
				},
			}),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{m.chat_asset_picker_title()}</DialogTitle>
					<DialogDescription>
						{m.chat_asset_picker_description()}
					</DialogDescription>
				</DialogHeader>

				<SearchField
					value={assets.search}
					onValueChange={assets.setSearch}
					placeholder={m.chat_asset_picker_search_placeholder()}
				/>

				<ScrollArea className="h-72 rounded-md border">
					<div className="divide-y">
						{assets.list.isError ? (
							<LoadError query={assets.list} />
						) : assets.loading ? (
							<Spinner className="mx-auto my-10 block size-8" />
						) : assets.rows.length === 0 ? (
							<Placeholder
								size="sm"
								title={m.chat_asset_picker_empty_state_title()}
								description={m.chat_asset_picker_empty_state_description()}
							/>
						) : (
							assets.rows.map((asset) => (
								<div
									key={asset.id}
									className="flex items-center justify-between gap-3 p-3"
								>
									<div className="min-w-0">
										<div className="flex min-w-0 items-center gap-2">
											<span className="truncate text-sm font-medium">
												{asset.title}
											</span>
											{asset.keptIn === "chat" ? (
												<Badge variant="outline" className="shrink-0">
													{m.assets_chat_upload_badge()}
												</Badge>
											) : null}
										</div>
										<div className="text-muted-foreground truncate text-xs">
											{getFileTypeLabel(asset.fileType)} ·{" "}
											{formatFileSize(asset.size)}
										</div>
									</div>
									{selectedAssetIds.has(asset.id) ? (
										<Button
											size="sm"
											type="button"
											variant="destructive"
											onClick={() => onRemoveAsset(asset.id)}
										>
											{m.common_remove_button()}
										</Button>
									) : (
										<Button
											size="sm"
											type="button"
											onClick={() => onAddAsset(asset)}
										>
											{m.chat_asset_picker_attach_action()}
										</Button>
									)}
								</div>
							))
						)}
					</div>
				</ScrollArea>

				<DialogFooter>
					<Pager variant="compact" {...assets.pager} />
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
