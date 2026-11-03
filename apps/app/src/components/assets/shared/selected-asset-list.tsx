import type { Asset, AssetWithCapabilities } from "@orcai/schema";
import { PencilIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { AssetMetadataDialog } from "@/components/assets/shared/asset-metadata-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/ui/composed/state-badge";
import { hasCapability } from "@/lib/authz/capabilities";
import { getFileTypeLabel } from "@/lib/presentation/file-type";
import {
	generatingMetadataBadge,
	isGeneratingMetadata,
} from "@/lib/presentation/metadata-status";
import { processingStatusBadge } from "@/lib/presentation/processing-status";
import { m } from "@/paraglide/messages";

/** Assets with their processing state, metadata editing and, given `onRemove`, removal. */
const SelectedAssetList = ({
	assets,
	onRemove,
	onAssetUpdated,
	metadataGenerated = false,
}: {
	assets: AssetWithCapabilities[];
	onRemove?: (assetId: string) => void;
	onAssetUpdated?: (asset: Asset) => void;
	/** Metadata is generated in the background, so editing it is the secondary action. */
	metadataGenerated?: boolean;
}) => {
	const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

	return (
		<div className="space-y-3">
			{assets.map((asset) => {
				const canEdit = hasCapability(asset.capabilities, "edit");

				return (
					<div
						key={asset.id}
						className="bg-background flex flex-wrap items-start justify-between gap-3 rounded-2xl border px-4 py-3 shadow-xs"
					>
						<div className="min-w-0 flex-1">
							<div className="truncate text-sm font-medium">{asset.title}</div>
							{asset.metadata.description ? (
								<p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
									{asset.metadata.description}
								</p>
							) : null}
							<div className="mt-1 flex flex-wrap gap-2 text-xs">
								<Badge variant="secondary">
									{getFileTypeLabel(asset.fileType)}
								</Badge>
								{asset.processingStatus ? (
									<StateBadge
										badge={processingStatusBadge(asset.processingStatus)}
									/>
								) : null}
								{isGeneratingMetadata(asset) ? (
									<StateBadge badge={generatingMetadataBadge()} />
								) : null}
							</div>
						</div>

						<div className="flex gap-2">
							{canEdit ? (
								<Button
									variant={metadataGenerated ? "ghost" : "outline"}
									size="sm"
									onClick={() => setEditingAssetId(asset.id)}
								>
									<PencilIcon />
									{m.assets_selected_list_metadata_button()}
								</Button>
							) : null}
							{onRemove ? (
								<Button
									variant="outline"
									size="sm"
									onClick={() => onRemove(asset.id)}
								>
									<XIcon />
									{m.common_remove_button()}
								</Button>
							) : null}
						</div>

						{canEdit ? (
							<AssetMetadataDialog
								asset={asset}
								open={editingAssetId === asset.id}
								onOpenChange={(open) =>
									setEditingAssetId(open ? asset.id : null)
								}
								onSaved={onAssetUpdated}
							/>
						) : null}
					</div>
				);
			})}
		</div>
	);
};

export { SelectedAssetList };
