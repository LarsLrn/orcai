import { skipToken, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
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
import { orpc } from "@/lib/orpc/orpc";
import type { Asset } from "@/lib/orpc/schemas/asset";
import type { BotEditorSelect } from "@/lib/orpc/schemas/bot-editor";

type DatabaseBlockValue = BotEditorSelect["databaseBlocks"][number];

const createDefaultDatabaseBlock = (): DatabaseBlockValue => ({
	name: "Knowledge Source",
	type: "database",
	status: "draft",
	config: {
		provider: "",
		embeddingModel: "",
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
	const { auth } = useRouteContext({
		from: "/app",
	});
	const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
	const [isLibraryOpen, setIsLibraryOpen] = useState(false);
	const [isUploadOpen, setIsUploadOpen] = useState(false);

	const { data: providers } = useSuspenseQuery(
		orpc.provider.list.queryOptions({
			input: {
				organizationId: auth.session.activeOrganizationId,
			},
		}),
	);

	const { data: embeddingModels } = useQuery(
		orpc.model.list.queryOptions({
			input: value.config.provider
				? {
						providerId: value.config.provider,
						capabilities: [
							"embedding",
						],
					}
				: skipToken,
		}),
	);

	const assets = value.assets;
	const providerOptions = providers.data;
	const selectedProvider = providerOptions.find(
		(provider) => provider.id === value.config.provider,
	);
	const embeddingOptions = embeddingModels?.data ?? [];
	const selectedEmbeddingModel = embeddingOptions.find(
		(model) => model.id === value.config.embeddingModel,
	);
	const providerItems =
		value.config.provider && !selectedProvider
			? [
					...providerOptions,
					{
						id: value.config.provider,
						name: value.config.provider,
					},
				]
			: providerOptions;
	const embeddingItems =
		value.config.embeddingModel && !selectedEmbeddingModel
			? [
					...embeddingOptions,
					{
						id: value.config.embeddingModel,
						name: value.config.embeddingModel,
					},
				]
			: embeddingOptions;

	return (
		<Card className="rounded-[28px] border-border/80 bg-background shadow-sm">
			<CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
				<div>
					<CardTitle className="flex items-center gap-2">
						<DatabaseIcon className="h-5 w-5" />
						Knowledge Source
					</CardTitle>
					<CardDescription>
						Attach reusable documents and tune how retrieval works for this bot.
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

					<div className="space-y-2">
						<Label>Provider</Label>
						<Select
							value={value.config.provider || undefined}
							onValueChange={(provider) =>
								onChange({
									...value,
									config: {
										...value.config,
										provider: provider ?? "",
										embeddingModel: "",
									},
								})
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Choose a provider" />
							</SelectTrigger>
							<SelectContent>
								{providerItems.map((provider) => (
									<SelectItem key={provider.id} value={provider.id}>
										{provider.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<Label>Embedding Model</Label>
						<Select
							value={value.config.embeddingModel || undefined}
							onValueChange={(embeddingModel) =>
								onChange({
									...value,
									config: {
										...value.config,
										embeddingModel: embeddingModel ?? "",
									},
								})
							}
							disabled={!value.config.provider}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Choose an embedding model" />
							</SelectTrigger>
							<SelectContent>
								{embeddingItems.map((model) => (
									<SelectItem key={model.id} value={model.id}>
										{model.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
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

				<div className="rounded-2xl border border-dashed bg-muted/20 p-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<div className="font-medium text-sm">Documents</div>
							<div className="text-muted-foreground text-sm">
								Use existing assets or upload new ones with metadata before
								attaching them.
							</div>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsLibraryOpen((current) => !current)}
							>
								<PlusIcon className="mr-2 h-4 w-4" />
								Add Existing
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsUploadOpen((current) => !current)}
							>
								<PlusIcon className="mr-2 h-4 w-4" />
								Upload New
							</Button>
						</div>
					</div>

					<Dialog open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
						<DialogContent className="max-h-[88vh] overflow-auto sm:max-w-5xl">
							<DialogHeader>
								<DialogTitle>Add Existing Documents</DialogTitle>
								<DialogDescription>
									Select reusable assets from the library and attach them to
									this knowledge source.
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
							/>
							<DialogFooter showCloseButton />
						</DialogContent>
					</Dialog>

					<Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
						<DialogContent className="max-h-[88vh] overflow-auto sm:max-w-5xl">
							<DialogHeader>
								<DialogTitle>Upload New Documents</DialogTitle>
								<DialogDescription>
									Upload files, complete their metadata, and attach them in one
									focused flow.
								</DialogDescription>
							</DialogHeader>
							<AssetIntakeFlow
								submitLabel="Save Documents"
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
							<div className="font-medium text-sm">Attached Documents</div>
							<div className="text-muted-foreground text-sm">
								Each document keeps its reusable asset metadata.
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
							No documents attached yet.
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
						</div>
					</CollapsibleContent>
				</Collapsible>
			</CardContent>
		</Card>
	);
};

export {
	DatabaseBlockEditor,
	createDefaultDatabaseBlock,
	type DatabaseBlockValue,
};
