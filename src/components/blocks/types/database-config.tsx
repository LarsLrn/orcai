import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { convert } from "convert";
import { formatDistanceToNow } from "date-fns";
import {
	BotIcon,
	CalendarIcon,
	HardDriveIcon,
	Move3dIcon,
	ServerIcon,
	SparklesIcon,
	StarIcon,
	ZapIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AnimatedGroup } from "@/components/ui/motion/animated-group";
import type { Asset } from "@/lib/orpc/schemas/asset";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";
import { assetQueryOptions } from "@/lib/query-options/asset";
import { taskQueryOptions } from "@/lib/query-options/task";
import { getFileTypeFromMime } from "@/lib/s3/upload-helpers";

/** --- Utility --- */
const fileTypeClass = (ext: string): string => {
	const map: Record<string, string> = {
		pdf: "bg-red-100 text-red-700 ring-1 ring-red-200",
		doc: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
		docx: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200",
		txt: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
		csv: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
		xls: "bg-green-100 text-green-700 ring-1 ring-green-200",
		xlsx: "bg-teal-100 text-teal-700 ring-1 ring-teal-200",
		ppt: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",
		pptx: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
		jpg: "bg-purple-100 text-purple-700 ring-1 ring-purple-200",
		jpeg: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
		png: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",
		md: "bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200",
		unknown: "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200",
	};

	return map[ext.toLowerCase()] ?? map.unknown;
};

/** --- Presentational --- */
const InfoRow = ({
	icon,
	label,
	value,
}: {
	icon: React.ReactNode;
	label: string;
	value: React.ReactNode;
}) => (
	<div className="flex items-center gap-2 text-sm">
		<div className="text-muted-foreground">{icon}</div>
		<div className="text-muted-foreground">{label}:</div>
		<div className="truncate font-medium">{value}</div>
	</div>
);

const AssetCard = ({ asset }: { asset: Asset }) => {
	const ext = getFileTypeFromMime(asset.fileType) || "unknown";

	return (
		<Card className="h-full">
			<CardHeader className="pb-2">
				<div className="flex items-start justify-between gap-3">
					<CardTitle className="line-clamp-2 break-words text-base leading-tight">
						{asset.title}
					</CardTitle>
					<Badge className={`${fileTypeClass(ext)} capitalize`}>{ext}</Badge>
				</div>
				{asset.metadata?.relevance && (
					<div className="mt-2 flex items-center gap-2">
						<SparklesIcon className="h-3.5 w-3.5 text-emerald-600" />
						<Badge variant="outline" className="text-xs">
							Relevance:{" "}
							{asset.metadata.relevance.charAt(0).toUpperCase() +
								asset.metadata.relevance.slice(1)}
						</Badge>
					</div>
				)}
			</CardHeader>
			<CardContent className="space-y-3 pt-0">
				<InfoRow
					icon={<HardDriveIcon className="h-4 w-4" />}
					label="Size"
					value={convert(asset.size, "bytes").to("best").toString()}
				/>
				<InfoRow
					icon={<CalendarIcon className="h-4 w-4" />}
					label="Created"
					value={
						asset.createdAt
							? formatDistanceToNow(asset.createdAt, { addSuffix: true })
							: "Unknown"
					}
				/>
			</CardContent>
		</Card>
	);
};

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
			<div className="flex items-center justify-between gap-4 px-4">
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
					<CollapsibleTrigger asChild>
						<Button size="sm" variant="outline">
							{isOpen ? "Hide Assets" : "Show Assets"}
						</Button>
					</CollapsibleTrigger>
				</div>
			</div>
			<CollapsibleContent>
				<AssetGrid assetIds={assetIds} />
			</CollapsibleContent>
		</Collapsible>
	);
};

export { DatabaseBlockConfigCard };
