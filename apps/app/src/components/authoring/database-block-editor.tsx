import type { ActivityRunId, BlockId } from "@orcai/core";
import {
	type Asset,
	type AssetWithCapabilities,
	type DatabaseBlock,
	defaultDatabaseBlockConfig,
} from "@orcai/schema";
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
import { useResourceVisibility } from "@/hooks/authz/use-resource-access";
import { useConfirmDiscard } from "@/hooks/use-unsaved-changes-guard";
import { emptyCapabilities, ownerCapabilities } from "@/lib/authz/capabilities";
import { m } from "@/paraglide/messages";

const createDefaultDatabaseBlock = (params?: { botName: string }) => ({
	name: params?.botName
		? m.authoring_database_block_default_name_named({
				botName: params.botName,
			})
		: m.authoring_database_block_default_name(),
	type: "database" as const,
	description: "",
	contentJson: null,
	contentHtml: "",
	status: "draft" as DatabaseBlock["status"],
	config: {
		...defaultDatabaseBlockConfig,
	},
	assetIds: [],
	assets: [],
	capabilities: {
		...emptyCapabilities("block"),
		edit: true,
		read: true,
		use: true,
	},
});

const mergeAssets = (
	currentAssets: AssetWithCapabilities[],
	incomingAssets: AssetWithCapabilities[],
) => {
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
	onUploadRun,
	onRemove,
	blockId,
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
	assets: AssetWithCapabilities[];
	onAssetsChange: (assets: AssetWithCapabilities[]) => void;
	/** An upload added assets; saving indexes them as part of its run. */
	onUploadRun: (runId: ActivityRunId) => void;
	onRemove?: () => void;
	blockId?: BlockId;
}) => {
	const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
	const [isLibraryOpen, setIsLibraryOpen] = useState(false);
	const [isUploadOpen, setIsUploadOpen] = useState(false);
	const [hasPendingUploads, setHasPendingUploads] = useState(false);
	const confirmDiscard = useConfirmDiscard();
	const visibility = useResourceVisibility(
		blockId
			? {
					type: "block",
					id: blockId,
				}
			: undefined,
	);

	const updateAsset = (asset: Asset) =>
		onAssetsChange(
			assets.map((existing) =>
				existing.id === asset.id
					? {
							...asset,
							capabilities: existing.capabilities,
						}
					: existing,
			),
		);

	const handleUploadOpenChange = async (open: boolean) => {
		if (!open && hasPendingUploads && !(await confirmDiscard())) {
			return;
		}
		setIsUploadOpen(open);
	};

	return (
		<Card className="min-w-0 rounded-2xl">
			<CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
				<div>
					<CardTitle className="flex items-center gap-2">
						<DatabaseIcon className="h-5 w-5" />
						{m.authoring_database_block_title()}
					</CardTitle>
					<CardDescription>
						{m.authoring_database_block_description()}
					</CardDescription>
				</div>
				{onRemove ? (
					<Button variant="outline" size="sm" onClick={onRemove}>
						{m.common_remove_button()}
					</Button>
				) : null}
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="grid gap-4 md:grid-cols-2">{nameField}</div>

				{descriptionField}
				{contentField}

				<div className="min-w-0 rounded-xl border border-dashed bg-muted/20 p-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<div className="font-medium text-sm">
								{m.authoring_database_block_assets_title()}
							</div>
							<div className="text-muted-foreground text-sm">
								{m.authoring_database_block_assets_description()}
							</div>
							{visibility.data?.data.visibility === "public" ? (
								<div className="text-muted-foreground text-sm">
									{m.authoring_database_block_listed_note()}
								</div>
							) : null}
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsLibraryOpen((current) => !current)}
							>
								<PlusIcon />
								{m.authoring_database_block_add_existing_action()}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsUploadOpen((current) => !current)}
							>
								<PlusIcon />
								{m.authoring_database_block_upload_new_action()}
							</Button>
						</div>
					</div>

					<Dialog open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
						<DialogContent className="max-h-[88vh] sm:max-w-5xl">
							<DialogHeader>
								<DialogTitle>
									{m.authoring_database_block_library_dialog_title()}
								</DialogTitle>
								<DialogDescription>
									{m.authoring_database_block_library_dialog_description()}
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

					<Dialog
						open={isUploadOpen}
						onOpenChange={(open) => void handleUploadOpenChange(open)}
					>
						<DialogContent className="max-h-[88vh] sm:max-w-5xl">
							<DialogHeader>
								<DialogTitle>
									{m.authoring_database_block_upload_dialog_title()}
								</DialogTitle>
								<DialogDescription>
									{m.authoring_database_block_upload_dialog_description()}
								</DialogDescription>
							</DialogHeader>
							<AssetIntakeFlow
								onPendingChange={setHasPendingUploads}
								onAssetsCreated={(createdAssets, _zedToken, runId) => {
									if (runId) onUploadRun(runId);
									const nextAssets = mergeAssets(
										assets,
										createdAssets.map((asset) => ({
											...asset,
											capabilities: ownerCapabilities("asset"),
										})),
									);
									onAssetsChange(nextAssets);
									onAssetIdsChange(nextAssets.map((asset) => asset.id));
								}}
								onAssetUpdated={updateAsset}
								onDone={() => setIsUploadOpen(false)}
							/>
						</DialogContent>
					</Dialog>
				</div>

				<div className="space-y-3">
					<div className="flex items-center justify-between gap-3">
						<div>
							<div className="font-medium text-sm">
								{m.authoring_database_block_attached_title()}
							</div>
							<div className="text-muted-foreground text-sm">
								{m.authoring_database_block_attached_description()}
							</div>
						</div>
						<Badge variant="secondary">
							{m.authoring_database_block_attached_badge({
								count: assets.length,
							})}
						</Badge>
					</div>

					{assets.length > 0 ? (
						<SelectedAssetList
							assets={assets}
							onRemove={(assetId) => {
								onAssetIdsChange(assetIds.filter((id) => id !== assetId));
								onAssetsChange(assets.filter((asset) => asset.id !== assetId));
							}}
							onAssetUpdated={updateAsset}
						/>
					) : (
						<div className="rounded-xl border border-dashed bg-muted/10 p-6 text-center text-muted-foreground text-sm">
							{m.authoring_database_block_assets_empty_state()}
						</div>
					)}
				</div>

				<Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
					<CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border bg-muted/15 px-4 py-3 text-left">
						<div>
							<div className="font-medium text-sm">
								{m.authoring_database_block_advanced_title()}
							</div>
							<div className="text-muted-foreground text-sm">
								{m.authoring_database_block_advanced_description()}
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
