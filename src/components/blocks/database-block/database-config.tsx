import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	BotIcon,
	Move3dIcon,
	ServerIcon,
	StarIcon,
	ZapIcon,
} from "lucide-react";
import { useState } from "react";
import { AssetCard } from "@/components/documents/asset-card";
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
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";
import { AnimatedGroup } from "@/components/ui/motion/animated-group";
import { Spinner } from "@/components/ui/spinner";
import { useCreateJobMutation } from "@/hooks/mutations/use-job-mutations";
import { orpc } from "@/lib/orpc/orpc";
import type { Asset } from "@/lib/orpc/schemas/asset";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";
import type { Job } from "@/lib/pg-boss/schema/job";
import type { JobQueue } from "@/lib/pg-boss/schema/job-queues";

/** --- Grid --- */
const AssetGrid = ({ assetIds }: { assetIds: Asset["id"][] }) => {
	const { data: assets, status } = useQuery(
		orpc.asset.list.queryOptions({
			input: {
				filters: {
					ids: assetIds,
				},
			},
		}),
	);

	if (status === "pending") {
		return <Spinner />;
	}

	if (status === "error") {
		return (
			<Card>
				<CardContent className="flex h-28 items-center justify-center gap-2 text-red-600 text-sm">
					<ZapIcon className="h-4 w-4" />
					Failed to load assets.
				</CardContent>
			</Card>
		);
	}

	if (assets.rowCount === 0) {
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
				{assets.data.map((asset) => (
					<AssetCard key={asset.id} asset={asset} />
				))}
			</AnimatedGroup>
		</div>
	);
};

/** --- Main Card --- */
const DatabaseBlockConfigCard = ({
	blockId,
	config,
	assetIds,
}: {
	blockId: DatabaseBlock["id"];
	config: DatabaseBlock["config"];
	assetIds: Asset["id"][];
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

			<AssetSection assetIds={assetIds} blockId={blockId} />
		</div>
	);
};

const AssetSection = ({
	assetIds,
	blockId,
}: {
	assetIds: Asset["id"][];
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
					<h4 className="font-semibold text-sm">Assets ({assetIds.length})</h4>
					<span className="text-muted-foreground text-sm">
						Assets will be used by the AI model for context.
					</span>
				</div>
				<div className="flex gap-2">
					<Button
						size="sm"
						onClick={() =>
							createJob({
								jobRunner: "process-asset-job",
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
			<div className="flex flex-col gap-4 px-4 xl:flex-row xl:items-start">
				<Item variant="outline">
					<ItemContent>
						<ItemTitle className="font-bold text-xl">
							Process Asset Jobs
						</ItemTitle>
						<JobSection jobQueue="process-asset-job" blockId={blockId} />
					</ItemContent>
				</Item>
				<Item variant="outline">
					<ItemContent>
						<ItemTitle className="font-bold text-xl">
							Vectorise Asset Jobs
						</ItemTitle>
						<JobSection jobQueue="vectorize-asset-job" blockId={blockId} />
					</ItemContent>
				</Item>
			</div>
			<CollapsibleContent>
				<AssetGrid assetIds={assetIds} />
			</CollapsibleContent>
		</Collapsible>
	);
};

const JobSection = ({
	jobQueue,
	blockId,
}: {
	jobQueue: JobQueue;
	blockId: DatabaseBlock["id"];
}) => {
	const { data: tasks } = useQuery(
		orpc.job.list.queryOptions({
			input: {
				jobQueue,
				resourceId: blockId,
			},
			refetchInterval: (query) => {
				// Refetch every 5 seconds if there are any queued or processing jobs
				const data = query.state.data;
				const hasActiveTasks = data?.data.some(
					(task) => task.state === "created" || task.state === "active",
				);
				return hasActiveTasks ? 5000 : false;
			},
		}),
	);

	return (
		<div>
			<p>Job Section</p>
			{tasks?.data?.map((task) => (
				<JobProgress key={task.id} task={task} />
			))}
		</div>
	);
};

const JobProgress = ({ task }: { task: Job }) => {
	return (
		<div className="mb-2 rounded border p-4">
			<div className="mb-2 flex flex-col gap-2">
				<span className="font-medium">
					Job ID: {task.id} | Name: {task.name}
				</span>
				<Badge variant="outline">State: {task.state}</Badge>
			</div>
		</div>
	);
};

export { DatabaseBlockConfigCard };
