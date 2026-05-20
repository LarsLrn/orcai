import type { BlockId } from "@orcai/core";
import type { Asset } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import {
	ChevronDownIcon,
	ExternalLinkIcon,
	MoreVerticalIcon,
	Move3dIcon,
} from "lucide-react";
import { useState } from "react";
import { AssetCard } from "@/components/documents/asset-card";
import { ContentRenderer } from "@/components/editor/content-renderer";
import { JobListDialog } from "@/components/jobs/job-list-dialog";
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
import { useCreateJobMutation } from "@/hooks/mutations/use-job-mutations";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";

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
						<div className="font-medium text-sm">Retrieval Configuration</div>
						<p className="text-muted-foreground text-sm">
							These settings control how the AI searches attached content.
						</p>
					</div>

					{/* Primary: mode + reference counts */}
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<div className="text-muted-foreground text-xs uppercase">
								Retrieval Mode
							</div>
							<Badge variant="secondary" className="capitalize">
								{config.retrievalMode ?? "hybrid"}
							</Badge>
						</div>
					</div>

					<Separator />

					<div className="space-y-2">
						<div className="font-medium text-sm">References</div>
						<div className="grid grid-cols-3 gap-3">
							<div className="rounded-lg border bg-muted/30 p-3 text-center">
								<div className="font-semibold text-xl tabular-nums">
									{config.minReferences}
								</div>
								<div className="mt-1 text-muted-foreground text-xs">
									Minimum
								</div>
							</div>
							<div className="rounded-lg border bg-muted/30 p-3 text-center">
								<div className="font-semibold text-xl tabular-nums">
									{config.defaultReferences}
								</div>
								<div className="mt-1 text-muted-foreground text-xs">
									Default
								</div>
							</div>
							<div className="rounded-lg border bg-muted/30 p-3 text-center">
								<div className="font-semibold text-xl tabular-nums">
									{config.maxReferences}
								</div>
								<div className="mt-1 text-muted-foreground text-xs">
									Maximum
								</div>
							</div>
						</div>
					</div>

					<Separator />

					{/* Advanced settings collapsible */}
					<Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
						<CollapsibleTrigger className="flex w-full items-center justify-between text-sm">
							<span className="font-medium">Advanced Settings</span>
							<ChevronDownIcon
								className={`size-4 text-muted-foreground transition-transform ${isAdvancedOpen ? "rotate-180" : ""}`}
							/>
						</CollapsibleTrigger>
						<CollapsibleContent className="pt-4">
							<div className="grid grid-cols-3 gap-3">
								<div className="rounded-lg border bg-muted/30 p-3 text-center">
									<div className="font-semibold text-xl tabular-nums">
										{config.scoreThreshold ?? 0.2}
									</div>
									<div className="mt-1 text-muted-foreground text-xs">
										Score Threshold
									</div>
								</div>
								<div className="rounded-lg border bg-muted/30 p-3 text-center">
									<div className="font-semibold text-xl tabular-nums">
										{config.candidateLimit ?? 40}
									</div>
									<div className="mt-1 text-muted-foreground text-xs">
										Candidate Limit
									</div>
								</div>
								<div className="rounded-lg border bg-muted/30 p-3 text-center">
									<div className="font-semibold text-xl tabular-nums">
										{config.maxPerAsset ?? 6}
									</div>
									<div className="mt-1 text-muted-foreground text-xs">
										Max Per Document
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
	const { mutate: createJob } = useCreateJobMutation();

	return (
		<Section>
			<SectionHeader>
				<SectionTitle>Content ({assets.length})</SectionTitle>
				<SectionDescription>
					This is the content currently attached to this knowledge base.
				</SectionDescription>
				<SectionAction>
					<JobListDialog
						jobQueue="vectorize-asset-job"
						resource={{
							resourceId: blockId,
							resourceType: "block",
						}}
					/>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button variant="ghost" size="icon">
									<MoreVerticalIcon className="size-4" />
									<span className="sr-only">More options</span>
								</Button>
							}
						/>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								onClick={() =>
									createJob({
										jobRunner: "vectorize-asset-job",
										blockId,
									})
								}
							>
								<Move3dIcon />
								Create Vector Store
							</DropdownMenuItem>
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
								View Vector Points
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
