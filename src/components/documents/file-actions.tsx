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
import type { Document } from "@/db/schema/document";
import { useDeleteAssets } from "@/lib/client-actions/use-delete";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";

const FileActions = ({
	fileInfo,
	filePath,
	className,
}: {
	fileInfo: Document;
	filePath: string;
	className?: string;
}) => {
	const courseId = "placeholder"; // TODO: Replace with actual courseId when available

	const { mutateAsync: createDocumentTask } = useMutation(
		orpc.task.createDocumentTask.mutationOptions(),
	);
	const { deleteAssets } = useDeleteAssets();

	const isProcessing =
		fileInfo.status === "generating-embedding" ||
		fileInfo.status === "processing-document";

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
					<TooltipContent>Download this document</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger asChild>
						<Link
							to={"/app/assets/$assetId/chunks"}
							params={{ assetId: fileInfo.id }}
						>
							<Button
								variant="outline"
								size="sm"
								className="flex items-center gap-1"
							>
								<FileSearch className="h-4 w-4" />
								<span className="hidden sm:inline">View Chunks</span>
							</Button>
						</Link>
					</TooltipTrigger>
					<TooltipContent>View document chunks</TooltipContent>
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
								createDocumentTask({
									courseId,
									taskType: "extract",
									ids: [fileInfo.id],
								})
							}
							className="flex items-center gap-2"
						>
							{isProcessing ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<FileSearch className="h-4 w-4" />
							)}
							Process Document
						</DropdownMenuItem>
						<DropdownMenuItem
							disabled={isProcessing}
							onClick={() =>
								createDocumentTask({
									courseId,
									taskType: "embed",
									ids: [fileInfo.id],
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
					params={{ assetId: fileInfo.id }}
				>
					<PencilIcon className="h-4 w-4" />
					<span className="hidden sm:inline">Edit</span>
				</Link>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="destructive"
							size="sm"
							onClick={() => deleteAssets({ refs: [{ id: fileInfo.id }] })}
							className="flex items-center gap-1"
						>
							<Trash2 className="h-4 w-4" />
							<span className="hidden sm:inline">Delete</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>Delete this document</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
};

export { FileActions };
