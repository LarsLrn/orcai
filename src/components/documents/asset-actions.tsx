import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	Database,
	Download,
	FileSearch,
	Loader2,
	PencilIcon,
	Trash2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Asset } from "@/db/schema/asset";
import { useDeleteAssets } from "@/lib/client-actions/use-delete";
import { taskQueryOptions } from "@/lib/query-options/task";
import { cn } from "@/lib/utils";

const AssetActions = ({
	assetInfo,
	filePath,
	className,
}: {
	assetInfo: Asset;
	filePath: string;
	className?: string;
}) => {
	const { mutateAsync: createAssetTask } = useMutation(
		taskQueryOptions.createAssetTask(),
	);
	const { deleteAssets } = useDeleteAssets();

	// TODO: Replace with actual processing state when available
	const isProcessing = false;

	return (
		<div
			className={cn(
				className,
				"flex flex-wrap items-center justify-between gap-2",
			)}
		>
			<div className="flex flex-wrap gap-2">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="default"
							size="sm"
							onClick={() => window.open(filePath, "_blank")}
							className="flex items-center gap-1"
						>
							<Download className="h-4 w-4" />
							<span className="hidden sm:inline">Download</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>Download this asset</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger asChild>
						<Link
							to={"/app/assets/$assetId/points"}
							params={{ assetId: assetInfo.id }}
						>
							<Button
								variant="outline"
								size="sm"
								className="flex items-center gap-1"
							>
								<FileSearch className="h-4 w-4" />
								<span className="hidden sm:inline">View Points</span>
							</Button>
						</Link>
					</TooltipTrigger>
					<TooltipContent>View asset points</TooltipContent>
				</Tooltip>
			</div>

			{/* Processing Actions */}
			<div className="flex flex-wrap items-center gap-2">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="secondary"
							size="sm"
							className="flex items-center gap-1"
						>
							<Database className="h-4 w-4" />
							<span className="hidden sm:inline">Process</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuLabel>Processing Options</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							disabled={isProcessing}
							onClick={() =>
								createAssetTask({
									taskType: "extract",
									ids: [assetInfo.id],
								})
							}
							className="flex items-center gap-2"
						>
							{isProcessing ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<FileSearch className="h-4 w-4" />
							)}
							Process Asset
						</DropdownMenuItem>
						<DropdownMenuItem
							disabled={isProcessing}
							onClick={() =>
								createAssetTask({
									taskType: "embed",
									ids: [assetInfo.id],
								})
							}
							className="flex items-center gap-2"
						>
							{isProcessing ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Database className="h-4 w-4" />
							)}
							Generate Embedding
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				<Link
					className={buttonVariants({ size: "sm", variant: "outline" })}
					to={"/app/assets/$assetId/edit"}
					params={{ assetId: assetInfo.id }}
				>
					<PencilIcon className="h-4 w-4" />
					<span className="hidden sm:inline">Edit</span>
				</Link>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="destructive"
							size="sm"
							onClick={() => deleteAssets({ refs: [{ id: assetInfo.id }] })}
							className="flex items-center gap-1"
						>
							<Trash2 className="h-4 w-4" />
							<span className="hidden sm:inline">Delete</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>Delete this asset</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
};

export { AssetActions };
