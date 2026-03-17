import { ChevronDownIcon, DatabaseIcon, PlusIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Asset } from "@/lib/orpc/schemas/asset";
import type { BotEditorSelect } from "@/lib/orpc/schemas/bot-editor";

type DatabaseBlockValue = BotEditorSelect["databaseBlocks"][number];

const createDefaultDatabaseBlock = (params?: {
	botName: string;
}): DatabaseBlockValue => ({
	name: `Content Collection${params?.botName ? ` for '${params.botName}'` : ""}`,
	type: "database",
	description: null,
	contentJson: null,
	contentHtml: null,
	status: "draft",
	config: {
		minReferences: 1,
		maxReferences: 8,
		defaultReferences: 4,
		retrievalMode: "hybrid",
		scoreThreshold: 0.2,
		candidateLimit: 40,
		maxPerAsset: 6,
	},
	assetIds: [],
	assets: [],
});

const mergeAssets = (
	current: DatabaseBlockValue,
	newAssets: Asset[],
): DatabaseBlockValue => {
	const knownIds = new Set(current.assets.map((asset) => asset.id));
	const addedAssets = newAssets.filter((asset) => !knownIds.has(asset.id));

	return {
		...current,
		assetIds: [
			...current.assetIds,
			...addedAssets.map((asset) => asset.id),
		],
		assets: [
			...current.assets,
			...addedAssets,
		],
	};
};

const DatabaseBlockEditor = ({
	value,
	onChange,
	onRemove,
}: {
	value: DatabaseBlockValue;
	onChange: (value: DatabaseBlockValue) => void;
	onRemove?: () => void;
}) => {
	const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
	const [isLibraryOpen, setIsLibraryOpen] = useState(false);
	const [isUploadOpen, setIsUploadOpen] = useState(false);

	const assets = value.assets;

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
				<div className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<Label>Name</Label>
						<Input
							value={value.name}
							onChange={(event) =>
								onChange({
									...value,
									name: event.target.value,
								})
							}
							placeholder="Course handbook"
						/>
					</div>
				</div>

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
						<DialogContent className="max-h-[88vh] overflow-auto sm:max-w-5xl">
							<DialogHeader>
								<DialogTitle>Add Existing Content</DialogTitle>
								<DialogDescription>
									Select reusable content items from the library and attach them
									to this content collection.
								</DialogDescription>
							</DialogHeader>
							<AssetLibraryPicker
								selectedIds={assets.map((asset) => asset.id)}
								onSelect={(asset) =>
									onChange(
										mergeAssets(value, [
											asset,
										]),
									)
								}
								onDeselect={(asset) =>
									onChange({
										...value,
										assetIds: value.assetIds.filter((id) => id !== asset.id),
										assets: value.assets.filter((a) => a.id !== asset.id),
									})
								}
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
									onChange(mergeAssets(value, savedAssets));
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
							onRemove={(assetId) =>
								onChange({
									...value,
									assetIds: value.assetIds.filter((id) => id !== assetId),
									assets: value.assets.filter((asset) => asset.id !== assetId),
								})
							}
							onAssetUpdated={(asset) =>
								onChange({
									...value,
									assets: value.assets.map((existing) =>
										existing.id === asset.id ? asset : existing,
									),
								})
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
							<div className="space-y-2">
								<Label>Minimum References</Label>
								<Input
									type="number"
									value={value.config.minReferences}
									onChange={(event) =>
										onChange({
											...value,
											config: {
												...value.config,
												minReferences: Number(event.target.value) || 1,
											},
										})
									}
								/>
							</div>
							<div className="space-y-2">
								<Label>Default References</Label>
								<Input
									type="number"
									value={value.config.defaultReferences}
									onChange={(event) =>
										onChange({
											...value,
											config: {
												...value.config,
												defaultReferences: Number(event.target.value) || 1,
											},
										})
									}
								/>
							</div>
							<div className="space-y-2">
								<Label>Maximum References</Label>
								<Input
									type="number"
									value={value.config.maxReferences}
									onChange={(event) =>
										onChange({
											...value,
											config: {
												...value.config,
												maxReferences: Number(event.target.value) || 1,
											},
										})
									}
								/>
							</div>
						</div>

						<div className="mt-4 grid gap-4 md:grid-cols-3">
							<div className="space-y-2">
								<Label>Candidate Limit</Label>
								<Input
									type="number"
									value={value.config.candidateLimit ?? 40}
									onChange={(event) =>
										onChange({
											...value,
											config: {
												...value.config,
												candidateLimit: Number(event.target.value) || 1,
											},
										})
									}
								/>
							</div>
							<div className="space-y-2">
								<Label>Max Per Document</Label>
								<Input
									type="number"
									value={value.config.maxPerAsset ?? 6}
									onChange={(event) =>
										onChange({
											...value,
											config: {
												...value.config,
												maxPerAsset: Number(event.target.value) || 1,
											},
										})
									}
								/>
							</div>
							<div className="space-y-2">
								<Label>Score Threshold</Label>
								<Input
									type="number"
									min="0"
									max="1"
									step="0.01"
									value={value.config.scoreThreshold ?? 0.2}
									onChange={(event) =>
										onChange({
											...value,
											config: {
												...value.config,
												scoreThreshold: Number(event.target.value) || 0,
											},
										})
									}
								/>
							</div>
							<div className="space-y-2">
								<Label>Retrieval Mode</Label>
								<Select
									value={value.config.retrievalMode ?? "hybrid"}
									onValueChange={(retrievalMode) =>
										onChange({
											...value,
											config: {
												...value.config,
												retrievalMode: retrievalMode as "dense" | "hybrid",
											},
										})
									}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="hybrid">Hybrid</SelectItem>
										<SelectItem value="dense">Dense</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</CollapsibleContent>
				</Collapsible>
			</CardContent>
		</Card>
	);
};

export {
	createDefaultDatabaseBlock,
	DatabaseBlockEditor,
	type DatabaseBlockValue,
};
