import type { ActivityRunId, BlockId } from "@orcai/core";
import {
	type Asset,
	type AssetWithCapabilities,
	defaultRepositoryConfig,
	type Repository,
} from "@orcai/schema";
import { ChevronDownIcon, DatabaseIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { AssetIntakeFlow } from "@/components/assets/shared/asset-intake-flow";
import { AssetLibraryPicker } from "@/components/assets/shared/asset-library-picker";
import { SelectedAssetList } from "@/components/assets/shared/selected-asset-list";
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
import { useResourceVisibility } from "@/hooks/access/use-resource-access";
import { withFieldGroup } from "@/hooks/form";
import { useConfirmDiscard } from "@/hooks/use-unsaved-changes-guard";
import { ownerCapabilities } from "@/lib/authz/capabilities";
import { m } from "@/paraglide/messages";

const repositoryGroupDefaultValues = {
	name: "",
	description: "",
	contentJson: null as unknown,
	config: defaultRepositoryConfig as Repository["config"],
};

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

const RepositoryFieldGroup = withFieldGroup({
	defaultValues: repositoryGroupDefaultValues,
	props: {} as {
		assets: AssetWithCapabilities[];
		onAssetsChange: (assets: AssetWithCapabilities[]) => void;
		/** An upload added assets; saving indexes them as part of its run. */
		onUploadRun: (runId: ActivityRunId) => void;
		onRemove?: () => void;
		blockId?: BlockId;
	},
	render: function Render({
		group,
		assets,
		onAssetsChange,
		onUploadRun,
		onRemove,
		blockId,
	}) {
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
		const removeAsset = (assetId: string) =>
			onAssetsChange(assets.filter((asset) => asset.id !== assetId));

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
							{m.authoring_repository_title()}
						</CardTitle>
						<CardDescription>
							{m.authoring_repository_description()}
						</CardDescription>
					</div>
					{onRemove ? (
						<Button variant="outline" size="sm" onClick={onRemove}>
							{m.common_remove_button()}
						</Button>
					) : null}
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="grid gap-4 md:grid-cols-2">
						<group.AppField
							name="name"
							children={(field) => (
								<field.TextField
									label={m.common_name_label()}
									placeholder={m.blocks_repository_form_name_placeholder()}
								/>
							)}
						/>
					</div>

					<group.AppField
						name="description"
						children={(field) => (
							<field.TextareaField
								label={m.blocks_repository_form_description_label()}
								placeholder={m.blocks_repository_form_description_placeholder()}
								rows={4}
							/>
						)}
					/>
					<group.AppField
						name="contentJson"
						children={(field) => (
							<field.BlockEditorField
								label={m.blocks_repository_form_content_label()}
							/>
						)}
					/>

					<div className="bg-muted/20 min-w-0 rounded-xl border border-dashed p-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<div className="text-sm font-medium">
									{m.authoring_repository_assets_title()}
								</div>
								<div className="text-muted-foreground text-sm">
									{m.authoring_repository_assets_description()}
								</div>
								{visibility.data?.data.visibility === "public" ? (
									<div className="text-muted-foreground text-sm">
										{m.authoring_repository_listed_note()}
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
									{m.authoring_repository_add_existing_action()}
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setIsUploadOpen((current) => !current)}
								>
									<PlusIcon />
									{m.authoring_repository_upload_new_action()}
								</Button>
							</div>
						</div>

						<Dialog open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
							<DialogContent className="max-h-[88vh] sm:max-w-5xl">
								<DialogHeader>
									<DialogTitle>
										{m.authoring_repository_library_dialog_title()}
									</DialogTitle>
									<DialogDescription>
										{m.authoring_repository_library_dialog_description()}
									</DialogDescription>
								</DialogHeader>
								<AssetLibraryPicker
									selectedIds={assets.map((asset) => asset.id)}
									scrollAreaClassName="max-h-[calc(88vh-14rem)]"
									onSelect={(asset) => {
										if (assets.some((existing) => existing.id === asset.id)) {
											return;
										}
										onAssetsChange(
											mergeAssets(assets, [
												asset,
											]),
										);
									}}
									onDeselect={(asset) => removeAsset(asset.id)}
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
										{m.authoring_repository_upload_dialog_title()}
									</DialogTitle>
									<DialogDescription>
										{m.authoring_repository_upload_dialog_description()}
									</DialogDescription>
								</DialogHeader>
								<AssetIntakeFlow
									onPendingChange={setHasPendingUploads}
									onAssetsCreated={(createdAssets, _zedToken, runId) => {
										if (runId) onUploadRun(runId);
										onAssetsChange(
											mergeAssets(
												assets,
												createdAssets.map((asset) => ({
													...asset,
													capabilities: ownerCapabilities("asset"),
												})),
											),
										);
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
								<div className="text-sm font-medium">
									{m.authoring_repository_attached_title()}
								</div>
								<div className="text-muted-foreground text-sm">
									{m.authoring_repository_attached_description()}
								</div>
							</div>
							<Badge variant="secondary">
								{m.authoring_repository_attached_badge({
									count: assets.length,
								})}
							</Badge>
						</div>

						{assets.length > 0 ? (
							<SelectedAssetList
								assets={assets}
								onRemove={removeAsset}
								onAssetUpdated={updateAsset}
							/>
						) : (
							<div className="bg-muted/10 text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
								{m.authoring_repository_assets_empty_state()}
							</div>
						)}
					</div>

					<Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
						<CollapsibleTrigger className="bg-muted/15 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left">
							<div>
								<div className="text-sm font-medium">
									{m.authoring_repository_advanced_title()}
								</div>
								<div className="text-muted-foreground text-sm">
									{m.authoring_repository_advanced_description()}
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
								<group.AppField
									name="config.minPassages"
									children={(field) => (
										<field.TextField
											label={m.blocks_repository_form_min_passages_label()}
											type="number"
										/>
									)}
								/>
								<group.AppField
									name="config.defaultPassages"
									children={(field) => (
										<field.TextField
											label={m.blocks_repository_form_default_passages_label()}
											type="number"
										/>
									)}
								/>
								<group.AppField
									name="config.maxPassages"
									children={(field) => (
										<field.TextField
											label={m.blocks_repository_form_max_passages_label()}
											type="number"
										/>
									)}
								/>
							</div>

							<div className="mt-4 grid gap-4 md:grid-cols-3">
								<group.AppField
									name="config.candidateLimit"
									children={(field) => (
										<field.TextField
											label={m.blocks_repository_form_candidate_limit_label()}
											type="number"
										/>
									)}
								/>
								<group.AppField
									name="config.maxPerAsset"
									children={(field) => (
										<field.TextField
											label={m.blocks_repository_form_per_asset_label()}
											type="number"
										/>
									)}
								/>
								<group.AppField
									name="config.scoreThreshold"
									children={(field) => (
										<field.TextField
											label={m.blocks_repository_form_score_threshold_label()}
											type="number"
											min={0}
											max={1}
											step={0.01}
										/>
									)}
								/>
								<group.AppField
									name="config.retrievalMode"
									children={(field) => (
										<field.SelectField
											label={m.blocks_repository_form_retrieval_mode_label()}
											options={[
												{
													value: "hybrid",
													label: m.blocks_retrieval_mode_hybrid_label(),
												},
												{
													value: "dense",
													label: m.blocks_retrieval_mode_dense_label(),
												},
												{
													value: "sparse",
													label: m.blocks_retrieval_mode_sparse_label(),
												},
											]}
										/>
									)}
								/>
							</div>
						</CollapsibleContent>
					</Collapsible>
				</CardContent>
			</Card>
		);
	},
});

export { RepositoryFieldGroup };
