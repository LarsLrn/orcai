import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useRealtimeBatch } from "@trigger.dev/react-hooks";
import {
	BotIcon,
	Move3dIcon,
	ServerIcon,
	StarIcon,
	ZapIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AssetPreview } from "@/components/documents/asset-preview";
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
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AnimatedGroup } from "@/components/ui/motion/animated-group";
import type { Asset } from "@/lib/orpc/schemas/asset";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";
import { assetQueryOptions } from "@/lib/query-options/asset";
import { taskQueryOptions } from "@/lib/query-options/task";

/** --- Grid --- */
const AssetGrid = ({ assetIds }: { assetIds: Asset["id"][] }) => {
	const { data: assets, status } = useQuery(
		assetQueryOptions.list({
			input: { filters: { ids: assetIds } },
		}),
	);

	if (status === "pending") {
		return <LoadingSpinner />;
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
					<AssetPreview key={asset.id} asset={asset} />
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
	const queryClient = useQueryClient();
	const { mutateAsync: createDatabaseBlockVectorStore } = useMutation(
		taskQueryOptions.createDatabaseBlockVectorStore(queryClient),
	);

	const [isOpen, setIsOpen] = useState(false);

	const handleCreateVectorStore = () => {
		toast.promise(
			createDatabaseBlockVectorStore({
				taskType: "extract",
				blockId,
			}),
			{
				success: "Vector store created successfully",
				loading: "Creating vector store...",
				error: "Failed to create vector store",
			},
		);
	};

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
					<Button size="sm" onClick={handleCreateVectorStore}>
						Create Vector Store
					</Button>
					<Link
						to="/app/blocks/$blockId/points"
						params={{ blockId }}
						className={buttonVariants({ variant: "outline", size: "sm" })}
					>
						View Vector Points
					</Link>
					<CollapsibleTrigger asChild>
						<Button size="sm" variant="outline">
							{isOpen ? "Hide Assets" : "Show Assets"}
						</Button>
					</CollapsibleTrigger>
				</div>
			</div>
			<TaskSection blockId={blockId} />
			<CollapsibleContent>
				<AssetGrid assetIds={assetIds} />
			</CollapsibleContent>
		</Collapsible>
	);
};

const TaskSection = ({ blockId }: { blockId: DatabaseBlock["id"] }) => {
	const { data } = useQuery(
		taskQueryOptions.list({ input: { resourceId: blockId } }),
	);

	return (
		<div>
			<p>Task Section</p>
			{data?.data.map((task) => (
				<TaskProgress
					key={task.runId}
					runId={task.runId}
					publicAccessToken={task.publicAccessToken}
				/>
			))}
		</div>
	);
};

const TaskProgress = ({
	runId,
	publicAccessToken,
}: {
	runId: string;
	publicAccessToken: string;
}) => {
	const { runs, error } = useRealtimeBatch(runId, {
		accessToken: publicAccessToken,
		baseURL: "http://host.docker.internal:8030",
		/* onComplete: (run, error) => {
			console.log("Run completed", run);
		}, */
	});

	return (
		<div>
			{runs.map((run) => (
				<div key={run.id} className="mb-2 rounded border p-4">
					<div className="mb-2 flex items-center gap-2">
						<BotIcon className="h-4 w-4" />
						<span className="font-medium">Run ID: {run.id}</span>
						<span className="text-muted-foreground text-sm">
							Status: {run.status}
						</span>
					</div>
				</div>
			))}
			{error && <div className="text-red-600">Error: {error.message}</div>}
		</div>
	);
};

export { DatabaseBlockConfigCard };
