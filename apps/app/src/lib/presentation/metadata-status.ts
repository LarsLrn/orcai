import type { Asset } from "@orcai/schema";
import { LoaderCircleIcon } from "lucide-react";
import type { BadgeItem } from "@/lib/presentation/badge-item";
import { m } from "@/paraglide/messages";

/** How often an asset is read again while its metadata is being generated. */
export const METADATA_POLL_MS = 3000;

/** Whether metadata is being generated for the asset. */
export const isGeneratingMetadata = (asset: Pick<Asset, "metadataStatus">) =>
	asset.metadataStatus === "pending" || asset.metadataStatus === "active";

/** Whether the asset is still being prepared or its metadata generated, so its view should be read again. */
export const isAssetWorking = (
	asset: Pick<Asset, "processingStatus" | "metadataStatus">,
) =>
	asset.processingStatus === "pending" ||
	asset.processingStatus === "active" ||
	isGeneratingMetadata(asset);

export const generatingMetadataBadge = (): BadgeItem => ({
	label: m.assets_metadata_generating_badge(),
	variant: "processing",
	icon: LoaderCircleIcon,
	className: "[&>svg]:animate-spin",
});
