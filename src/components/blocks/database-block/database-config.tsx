import { Link } from "@tanstack/react-router";
import { BotIcon, Move3dIcon, ServerIcon, StarIcon } from "lucide-react";
import { useState } from "react";
import type { DatabaseBlockValue } from "@/components/authoring/database-block-editor";
import { AssetCard } from "@/components/documents/asset-card";
import { JobListDialog } from "@/components/jobs/job-list-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { AnimatedGroup } from "@/components/ui/motion/animated-group";
import { useCreateJobMutation } from "@/hooks/mutations/use-job-mutations";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";

/** --- Grid --- */
const AssetGrid = ({ assets }: { assets: DatabaseBlockValue["assets"] }) => {
	if (assets.length === 0) {
		return (
			<Card>
				<CardContent className="flex h-28 items-center justify-center gap-2 text-muted-foreground text-sm">
					<StarIcon className="h-4 w-4" />
					No assets found.
				</CardContent>
			</Card>
		);
	}

	return (
		<div>
			<AnimatedGroup
				className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3"
				preset="fade"
			>
				{assets.map((entry) => (
					<AssetCard key={entry.id} asset={entry} />
				))}
			</AnimatedGroup>
		</div>
	);
};

/** --- Main Card --- */
const DatabaseBlockConfigCard = ({
	blockId,
	config,
	assets,
}: {
	blockId: DatabaseBlock["id"];
	config: DatabaseBlock["config"];
	assets: DatabaseBlockValue["assets"];
}) => {
	return (
		<div className="flex flex-col gap-4">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<BotIcon className="h-5 w-5" />
						AI Configuration
					</CardTitle>
					<CardDescription>
						Configure the AI provider, embedding model, and reference behavior
						for this block.
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-6">
					{/* Provider / Model */}
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div className="space-y-2">
							<div className="font-medium text-sm">Provider</div>
							<div className="flex items-center gap-2">
								<ServerIcon className="h-4 w-4 text-muted-foreground" />
								<Badge variant="secondary" className="capitalize">
									{config.provider}
								</Badge>
							</div>
						</div>

						<div className="space-y-2">
							<div className="font-medium text-sm">Embedding Model</div>
							<div className="flex items-center gap-2">
								<Move3dIcon className="h-4 w-4 text-muted-foreground" />
								<Badge variant="default">{config.embeddingModel}</Badge>
							</div>
						</div>
					</div>

					{/* Reference settings */}
					<div className="space-y-3">
						<div className="font-medium text-sm">Reference Configuration</div>
						<div className="flex items-center gap-6">
							<div className="flex flex-col items-center gap-1">
								<div className="text-muted-foreground text-xs">Minimum</div>
								<Badge variant="outline">{config.minReferences}</Badge>
							</div>
							<div className="flex flex-col items-center gap-1">
								<div className="text-muted-foreground text-xs">Default</div>
								<Badge variant="outline">{config.defaultReferences}</Badge>
							</div>
							<div className="flex flex-col items-center gap-1">
								<div className="text-muted-foreground text-xs">Maximum</div>
								<Badge variant="outline">{config.maxReferences}</Badge>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Assets */}

			<AssetSection assets={assets} blockId={blockId} />
		</div>
	);
};

const AssetSection = ({
	assets,
	blockId,
}: {
	assets: DatabaseBlockValue["assets"];
	blockId: DatabaseBlock["id"];
}) => {
	const { mutate: createJob } = useCreateJobMutation();

	const [isOpen, setIsOpen] = useState(false);

	return (
		<Collapsible
			open={isOpen}
			onOpenChange={setIsOpen}
			className="flex flex-col gap-4"
		>
			<div className="flex flex-col justify-between gap-4 px-4 xl:flex-row xl:items-center">
				<div>
					<h4 className="font-semibold text-sm">Assets ({assets.length})</h4>
					<span className="text-muted-foreground text-sm">
						Assets will be used by the AI model for context.
					</span>
				</div>
				<div className="flex gap-2">
					<Button
						size="sm"
						onClick={() =>
							createJob({
								jobRunner: "vectorize-asset-job",
								blockId,
							})
						}
					>
						Create Vector Store
					</Button>
					<Link
						to="/app/hub/blocks/$blockId/points"
						params={{
							blockId,
						}}
						className={buttonVariants({
							variant: "outline",
							size: "sm",
						})}
					>
						View Vector Points
					</Link>
					<CollapsibleTrigger
						render={
							<Button size="sm" variant="outline">
								{isOpen ? "Hide Assets" : "Show Assets"}
							</Button>
						}
					/>
				</div>
			</div>
			<div className="flex gap-2 px-4">
				<JobListDialog
					jobQueue="process-asset-job"
					resourceId={blockId}
					resourceType="block"
				/>
				<JobListDialog
					jobQueue="vectorize-asset-job"
					resourceId={blockId}
					resourceType="block"
				/>
			</div>
			<CollapsibleContent>
				<AssetGrid assets={assets} />
			</CollapsibleContent>
		</Collapsible>
	);
};

export { DatabaseBlockConfigCard };
