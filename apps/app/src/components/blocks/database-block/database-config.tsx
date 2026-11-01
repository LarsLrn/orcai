import type { BlockId } from "@orcai/core";
import {
	type Asset,
	type AssetReadiness,
	type DatabaseBlock,
	isRetryableFailure,
	type RepositoryReadiness,
} from "@orcai/schema";
import { ChevronDownIcon, RotateCwIcon, TelescopeIcon } from "lucide-react";
import { useState } from "react";
import { CompactAssetTile } from "@/components/assets/asset-tile";
import { useRepositoryReadiness } from "@/components/assets/readiness/use-repository-readiness";
import { ContentRenderer } from "@/components/editor/content-renderer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { HeaderActions } from "@/components/ui/shell/actions";
import {
	Section,
	SectionContent,
	SectionDescription,
	SectionGrid,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import { Spinner } from "@/components/ui/spinner";
import {
	useRetryDocumentMutation,
	useRetryFailedDocumentsMutation,
} from "@/hooks/mutations/use-block-mutations";
import { m } from "@/paraglide/messages";

const getRetrievalModeLabel = (
	mode: DatabaseBlock["config"]["retrievalMode"],
) =>
	mode === "dense"
		? m.blocks_retrieval_mode_dense_label()
		: mode === "sparse"
			? m.blocks_retrieval_mode_sparse_label()
			: m.blocks_retrieval_mode_hybrid_label();

/** --- Main Card --- */
const DatabaseBlockConfigCard = ({
	blockId,
	config,
	description,
	contentJson,
	assets,
	explorable,
}: {
	blockId: BlockId;
	config: DatabaseBlock["config"];
	description: DatabaseBlock["description"];
	contentJson: DatabaseBlock["contentJson"];
	assets: Asset[];
	/** A ready repository can be explored. */
	explorable: boolean;
}) => {
	const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

	return (
		<div className="flex flex-col gap-4">
			<Card>
				<CardContent className="space-y-6">
					{description && (
						<div className="space-y-2">
							<p className="text-muted-foreground text-sm">{description}</p>
							<Separator className="my-4" />
						</div>
					)}

					{contentJson && (
						<div className="prose prose-sm max-w-none">
							<ContentRenderer content={contentJson} />
						</div>
					)}

					<div className="space-y-1">
						<div className="font-medium text-sm">
							{m.blocks_database_config_retrieval_title()}
						</div>
						<p className="text-muted-foreground text-sm">
							{m.blocks_database_config_retrieval_description()}
						</p>
					</div>

					{/* Primary: mode + reference counts */}
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<div className="text-muted-foreground text-xs uppercase">
								{m.blocks_database_config_retrieval_mode_label()}
							</div>
							<Badge variant="secondary">
								{getRetrievalModeLabel(config.retrievalMode)}
							</Badge>
						</div>
					</div>

					<Separator />

					<div className="space-y-2">
						<div className="font-medium text-sm">
							{m.blocks_database_config_references_title()}
						</div>
						<div className="grid grid-cols-3 gap-3">
							<div className="rounded-xl border bg-muted/30 p-3 text-center">
								<div className="font-semibold text-xl tabular-nums">
									{config.minReferences}
								</div>
								<div className="mt-1 text-muted-foreground text-xs">
									{m.blocks_database_config_min_references_label()}
								</div>
							</div>
							<div className="rounded-xl border bg-muted/30 p-3 text-center">
								<div className="font-semibold text-xl tabular-nums">
									{config.defaultReferences}
								</div>
								<div className="mt-1 text-muted-foreground text-xs">
									{m.blocks_database_config_default_references_label()}
								</div>
							</div>
							<div className="rounded-xl border bg-muted/30 p-3 text-center">
								<div className="font-semibold text-xl tabular-nums">
									{config.maxReferences}
								</div>
								<div className="mt-1 text-muted-foreground text-xs">
									{m.blocks_database_config_max_references_label()}
								</div>
							</div>
						</div>
					</div>

					<Separator />

					{/* Advanced settings collapsible */}
					<Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
						<CollapsibleTrigger className="flex w-full items-center justify-between text-sm">
							<span className="font-medium">
								{m.blocks_database_config_advanced_settings_label()}
							</span>
							<ChevronDownIcon
								className={`size-4 text-muted-foreground transition-transform ${isAdvancedOpen ? "rotate-180" : ""}`}
							/>
						</CollapsibleTrigger>
						<CollapsibleContent className="pt-4">
							<div className="grid grid-cols-3 gap-3">
								<div className="rounded-xl border bg-muted/30 p-3 text-center">
									<div className="font-semibold text-xl tabular-nums">
										{config.scoreThreshold ?? 0.2}
									</div>
									<div className="mt-1 text-muted-foreground text-xs">
										{m.blocks_database_config_score_threshold_label()}
									</div>
								</div>
								<div className="rounded-xl border bg-muted/30 p-3 text-center">
									<div className="font-semibold text-xl tabular-nums">
										{config.candidateLimit ?? 40}
									</div>
									<div className="mt-1 text-muted-foreground text-xs">
										{m.blocks_database_config_candidate_limit_label()}
									</div>
								</div>
								<div className="rounded-xl border bg-muted/30 p-3 text-center">
									<div className="font-semibold text-xl tabular-nums">
										{config.maxPerAsset ?? 6}
									</div>
									<div className="mt-1 text-muted-foreground text-xs">
										{m.blocks_database_config_per_asset_label()}
									</div>
								</div>
							</div>
						</CollapsibleContent>
					</Collapsible>
				</CardContent>
			</Card>

			<AssetSection assets={assets} blockId={blockId} explorable={explorable} />
		</div>
	);
};

const AssetSection = ({
	assets,
	blockId,
	explorable,
}: {
	assets: Asset[];
	blockId: BlockId;
	explorable: boolean;
}) => {
	const { data } = useRepositoryReadiness([
		blockId,
	]);
	const readiness = data?.data[0];
	const canEdit = readiness?.capabilities.edit === true;
	const assetById = new Map(
		readiness?.assets.map((asset) => [
			asset.assetId,
			asset,
		]),
	);
	const retryable = (asset: AssetReadiness | undefined) =>
		canEdit &&
		Boolean(asset?.failure) &&
		isRetryableFailure(asset?.failure?.kind ?? "other");
	const { mutate: retryDocument, isPending: retryingDocument } =
		useRetryDocumentMutation();
	const { mutate: retryFailed, isPending: retryingFailed } =
		useRetryFailedDocumentsMutation();

	return (
		<Section>
			<SectionHeader>
				<SectionTitle>
					{m.blocks_database_config_assets_title({
						count: assets.length,
					})}
				</SectionTitle>
				<SectionDescription>
					{m.blocks_database_config_assets_description()}
				</SectionDescription>
				<HeaderActions
					actions={[
						readiness?.assets.some(retryable) && {
							key: "retry-failed",
							label: m.blocks_database_config_retry_failed_action(),
							icon: RotateCwIcon,
							disabled: retryingFailed,
							onClick: () =>
								retryFailed({
									blockId,
								}),
						},
						explorable && {
							key: "explore",
							label: m.blocks_database_config_explore_action(),
							icon: TelescopeIcon,
							linkProps: {
								to: "/app/library/repositories/$blockId/explore",
								params: {
									blockId,
								},
							},
						},
					]}
				/>
			</SectionHeader>
			{readiness && readiness.totals.total > 0 && (
				<ReadinessSummary totals={readiness.totals} />
			)}
			<SectionContent>
				<SectionGrid>
					{assets.map((entry) => {
						const assetReadiness = assetById.get(entry.id);
						return (
							<CompactAssetTile
								key={entry.id}
								asset={entry}
								readiness={assetReadiness}
								actions={
									retryable(assetReadiness)
										? [
												{
													key: "retry",
													label: m.assets_tile_retry_action(),
													icon: RotateCwIcon,
													disabled: retryingDocument,
													onClick: () =>
														retryDocument({
															blockId,
															assetId: entry.id,
														}),
												},
											]
										: []
								}
							/>
						);
					})}
				</SectionGrid>
			</SectionContent>
		</Section>
	);
};

/** How many of the repository's assets are searchable, preparing or failed. */
const ReadinessSummary = ({
	totals,
}: {
	totals: RepositoryReadiness["totals"];
}) => (
	<p
		role="status"
		className="flex items-center gap-2 text-muted-foreground text-sm"
	>
		{totals.preparing > 0 && <Spinner className="size-3.5" />}
		<span>
			{m.blocks_database_config_readiness_summary({
				ready: totals.ready,
				total: totals.total,
			})}
		</span>
		{totals.failed > 0 && (
			<span className="text-status-danger">
				{m.blocks_database_config_readiness_failed({
					count: totals.failed,
				})}
			</span>
		)}
	</p>
);

export { DatabaseBlockConfigCard };
