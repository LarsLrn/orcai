import type { BlockId } from "@orcai/core";
import type { Asset, DatabaseBlock } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import {
	ChevronDownIcon,
	ExternalLinkIcon,
	MoreVerticalIcon,
} from "lucide-react";
import { useState } from "react";
import { AssetCard } from "@/components/documents/asset-card";
import { ContentRenderer } from "@/components/editor/content-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
	Section,
	SectionAction,
	SectionContent,
	SectionDescription,
	SectionGrid,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
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
}: {
	blockId: BlockId;
	config: DatabaseBlock["config"];
	description: DatabaseBlock["description"];
	contentJson: DatabaseBlock["contentJson"];
	assets: Asset[];
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
										{m.blocks_database_config_max_per_asset_label()}
									</div>
								</div>
							</div>
						</CollapsibleContent>
					</Collapsible>
				</CardContent>
			</Card>

			<AssetSection assets={assets} blockId={blockId} />
		</div>
	);
};

const AssetSection = ({
	assets,
	blockId,
}: {
	assets: Asset[];
	blockId: BlockId;
}) => {
	const navigate = useNavigate();

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
				<SectionAction>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button variant="ghost" size="icon">
									<MoreVerticalIcon className="size-4" />
									<span className="sr-only">
										{m.blocks_database_config_assets_menu_trigger()}
									</span>
								</Button>
							}
						/>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								onClick={() =>
									navigate({
										to: "/app/hub/blocks/$blockId/points",
										params: {
											blockId,
										},
									})
								}
							>
								<ExternalLinkIcon />
								{m.blocks_database_config_view_vector_points_action()}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</SectionAction>
			</SectionHeader>
			<SectionContent>
				<SectionGrid>
					{assets.map((entry) => (
						<AssetCard key={entry.id} asset={entry} />
					))}
				</SectionGrid>
			</SectionContent>
		</Section>
	);
};

export { DatabaseBlockConfigCard };
