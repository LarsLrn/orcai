import { PencilIcon, XIcon } from "lucide-react";
import { useState } from "react";
import {
	AssetMetadataEditor,
	createDefaultAssetMetadata,
} from "@/components/documents/shared/asset-metadata-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useSaveAssetMutation } from "@/hooks/mutations/use-asset-mutations";
import type { Asset } from "@/lib/orpc/schemas/asset";
import { getProcessingStatusLabel } from "@/lib/presentation/processing-status";

const SelectedAssetList = ({
	assets,
	onRemove,
	onAssetUpdated,
}: {
	assets: Asset[];
	onRemove: (assetId: string) => void;
	onAssetUpdated?: (asset: Asset) => void;
}) => {
	const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
	const [drafts, setDrafts] = useState<
		Record<
			string,
			{
				title: string;
				metadata: Asset["metadata"];
			}
		>
	>({});
	const { mutateAsync: saveAsset } = useSaveAssetMutation();

	return (
		<div className="space-y-3">
			{assets.map((asset) => {
				const draft = drafts[asset.id] ?? {
					title: asset.title,
					metadata: asset.metadata ?? createDefaultAssetMetadata(),
				};

				return (
					<div
						key={asset.id}
						className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-background px-4 py-3 shadow-xs"
					>
						<div className="min-w-0 flex-1">
							<div className="truncate font-medium text-sm">{asset.title}</div>
							<div className="mt-1 flex flex-wrap gap-2 text-xs">
								<Badge variant="secondary">{asset.fileType}</Badge>
								{asset.processingStatus ? (
									<Badge variant="outline">
										{getProcessingStatusLabel(asset.processingStatus)}
									</Badge>
								) : null}
							</div>
						</div>

						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setEditingAssetId(asset.id)}
							>
								<PencilIcon className="mr-2 h-4 w-4" />
								Metadata
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => onRemove(asset.id)}
							>
								<XIcon className="mr-2 h-4 w-4" />
								Remove
							</Button>
						</div>

						<Dialog
							open={editingAssetId === asset.id}
							onOpenChange={(open) => setEditingAssetId(open ? asset.id : null)}
						>
							<DialogContent className="max-h-[88vh] sm:max-w-3xl">
								<DialogHeader>
									<DialogTitle>Edit Source Metadata</DialogTitle>
									<DialogDescription>
										Update how this content item should appear when cited by the
										AI.
									</DialogDescription>
								</DialogHeader>

								<AssetMetadataEditor
									value={draft}
									onChange={(nextValue) =>
										setDrafts((current) => ({
											...current,
											[asset.id]: nextValue,
										}))
									}
								/>

								<DialogFooter>
									<Button
										onClick={async () => {
											const result = await saveAsset({
												id: asset.id,
												title: draft.title,
												metadata: draft.metadata,
											});

											if (result.status === "success") {
												onAssetUpdated?.(result.data.data);
												setEditingAssetId(null);
											}
										}}
									>
										Save Metadata
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
				);
			})}
		</div>
	);
};

export { SelectedAssetList };
