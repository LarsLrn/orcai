import type { Asset } from "@orcai/schema";
import { ChevronDownIcon, DatabaseIcon, PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { AssetIntakeFlow } from "@/components/documents/shared/asset-intake-flow";
import { AssetLibraryPicker } from "@/components/documents/shared/asset-library-picker";
import { SelectedAssetList } from "@/components/documents/shared/selected-asset-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";

const createDefaultDatabaseBlock = (params?: { botName: string }) => ({
	name: `Content Collection${params?.botName ? ` for '${params.botName}'` : ""}`,
	type: "database" as const,
	description: "",
	contentJson: null,
	contentHtml: "",
	status: "draft" as DatabaseBlock["status"],
	config: {
		minReferences: 1,
		maxReferences: 8,
		defaultReferences: 4,
		retrievalMode: "hybrid" as const,
		scoreThreshold: 0.2,
		candidateLimit: 40,
		maxPerAsset: 6,
	},
	assetIds: [],
	assets: [],
	canEdit: true,
});

const mergeAssets = (currentAssets: Asset[], incomingAssets: Asset[]) => {
	const knownIds = new Set(currentAssets.map((asset) => asset.id));
	const addedAssets = incomingAssets.filter((asset) => !knownIds.has(asset.id));

	return [
		...currentAssets,
		...addedAssets,
	];
};

const DatabaseBlockEditor = ({
	nameField,
	descriptionField,
	contentField,
	minReferencesField,
	defaultReferencesField,
	maxReferencesField,
	candidateLimitField,
	maxPerAssetField,
	scoreThresholdField,
	retrievalModeField,
	assetIds,
	onAssetIdsChange,
	assets,
	onAssetsChange,
	onRemove,
}: {
	nameField: ReactNode;
	descriptionField: ReactNode;
	contentField: ReactNode;
	minReferencesField: ReactNode;
	defaultReferencesField: ReactNode;
	maxReferencesField: ReactNode;
	candidateLimitField: ReactNode;
	maxPerAssetField: ReactNode;
	scoreThresholdField: ReactNode;
	retrievalModeField: ReactNode;
	assetIds: string[];
	onAssetIdsChange: (ids: string[]) => void;
	assets: Asset[];
	onAssetsChange: (assets: Asset[]) => void;
	onRemove?: () => void;
}) => {
	const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
	const [isLibraryOpen, setIsLibraryOpen] = useState(false);
	const [isUploadOpen, setIsUploadOpen] = useState(false);

	return (
		<Card>
			<CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
				<div>
					<CardTitle className="flex items-center gap-2">
						<DatabaseIcon className="h-5 w-5" />
						Content Collection
					</CardTitle>
					<CardDescription>
						Attach reusable content and tune how retrieval works for this bot.
					</CardDescription>
				</div>
				{onRemove ? (
					<Button variant="outline" size="sm" onClick={onRemove}>
						Remove
					</Button>
				) : null}
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="grid gap-4 md:grid-cols-2">{nameField}</div>

				{descriptionField}
				{contentField}

				<div className="rounded-2xl border border-dashed bg-muted/20 p-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<div className="font-medium text-sm">Content items</div>
							<div className="text-muted-foreground text-sm">
								Use existing content from the library or upload new files with
								metadata before attaching them.
							</div>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsLibraryOpen((current) => !current)}
							>
								<PlusIcon />
								Add Existing
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsUploadOpen((current) => !current)}
							>
								<PlusIcon />
								Upload New
							</Button>
						</div>
					</div>

					<Dialog open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
						<DialogContent className="max-h-[88vh] sm:max-w-5xl">
							<DialogHeader>
								<DialogTitle>Add Existing Content</DialogTitle>
								<DialogDescription>
									Select reusable content items from the library and attach them
									to this content collection.
								</DialogDescription>
							</DialogHeader>
							<AssetLibraryPicker
								selectedIds={assetIds}
								scrollAreaClassName="max-h-[calc(88vh-14rem)]"
								onSelect={(asset) => {
									if (assetIds.includes(asset.id)) {
										return;
									}

									onAssetIdsChange([
										...assetIds,
										asset.id,
									]);
									onAssetsChange(
										mergeAssets(assets, [
											asset,
										]),
									);
								}}
								onDeselect={(asset) => {
									onAssetIdsChange(assetIds.filter((id) => id !== asset.id));
									onAssetsChange(assets.filter((a) => a.id !== asset.id));
								}}
							/>
							<DialogFooter showCloseButton />
						</DialogContent>
					</Dialog>

					<Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
						<DialogContent className="max-h-[88vh] overflow-auto sm:max-w-5xl">
							<DialogHeader>
								<DialogTitle>Upload New Content</DialogTitle>
								<DialogDescription>
									Upload files, complete their metadata, and attach them in one
									focused flow.
								</DialogDescription>
							</DialogHeader>
							<AssetIntakeFlow
								submitLabel="Save Content"
								onAssetsSaved={(savedAssets) => {
									const nextAssets = mergeAssets(assets, savedAssets);
									onAssetsChange(nextAssets);
									onAssetIdsChange(nextAssets.map((asset) => asset.id));
									setIsUploadOpen(false);
								}}
							/>
						</DialogContent>
					</Dialog>
				</div>

				<div className="space-y-3">
					<div className="flex items-center justify-between gap-3">
						<div>
							<div className="font-medium text-sm">Attached Content</div>
							<div className="text-muted-foreground text-sm">
								Each item keeps its reusable metadata from the content library.
							</div>
						</div>
						<Badge variant="secondary">{assets.length} attached</Badge>
					</div>

					{assets.length > 0 ? (
						<SelectedAssetList
							assets={assets}
							onRemove={(assetId) => {
								onAssetIdsChange(assetIds.filter((id) => id !== assetId));
								onAssetsChange(assets.filter((asset) => asset.id !== assetId));
							}}
							onAssetUpdated={(asset) =>
								onAssetsChange(
									assets.map((existing) =>
										existing.id === asset.id ? asset : existing,
									),
								)
							}
						/>
					) : (
						<div className="rounded-xl border border-dashed bg-muted/10 p-6 text-center text-muted-foreground text-sm">
							No content attached yet.
						</div>
					)}
				</div>

				<Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
					<CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border bg-muted/15 px-4 py-3 text-left">
						<div>
							<div className="font-medium text-sm">
								Advanced retrieval settings
							</div>
							<div className="text-muted-foreground text-sm">
								Tune reference counts and retrieval constraints.
							</div>
						</div>
						<ChevronDownIcon
							className={`h-4 w-4 transition-transform ${
								isAdvancedOpen ? "rotate-180" : ""
							}`}
						/>
					</CollapsibleTrigger>
					<CollapsibleContent className="pt-4">
						<div className="grid gap-4 md:grid-cols-3">
							{minReferencesField}
							{defaultReferencesField}
							{maxReferencesField}
						</div>

						<div className="mt-4 grid gap-4 md:grid-cols-3">
							{candidateLimitField}
							{maxPerAssetField}
							{scoreThresholdField}
							{retrievalModeField}
						</div>
					</CollapsibleContent>
				</Collapsible>
			</CardContent>
		</Card>
	);
};

export { createDefaultDatabaseBlock, DatabaseBlockEditor };
