import { Link } from "@tanstack/react-router";
import { Download, PencilIcon, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDeleteAssetsMutation } from "@/hooks/mutations/use-asset-mutations";
import type { Asset } from "@/lib/orpc/schemas/asset";
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
	const { mutate: deleteAssets } = useDeleteAssetsMutation();

	return (
		<div
			className={cn(
				className,
				"flex flex-wrap items-center justify-between gap-2",
			)}
		>
			<div className="flex flex-wrap gap-2">
				<Tooltip>
					<TooltipTrigger
						render={
							<Button
								variant="default"
								size="sm"
								onClick={() => window.open(filePath, "_blank")}
								className="flex items-center gap-1"
							>
								<Download className="h-4 w-4" />
								<span className="hidden sm:inline">Download</span>
							</Button>
						}
					/>
					<TooltipContent>Download this asset</TooltipContent>
				</Tooltip>
			</div>

			{/* Processing Actions */}
			<div className="flex flex-wrap items-center gap-2">
				<Link
					className={buttonVariants({ size: "sm", variant: "outline" })}
					to={"/app/hub/assets/$assetId/edit"}
					params={{ assetId: assetInfo.id }}
				>
					<PencilIcon className="h-4 w-4" />
					<span className="hidden sm:inline">Edit</span>
				</Link>

				<Tooltip>
					<TooltipTrigger
						render={
							<Button
								variant="destructive"
								size="sm"
								onClick={() => deleteAssets({ refs: [{ id: assetInfo.id }] })}
								className="flex items-center gap-1"
							>
								<Trash2 className="h-4 w-4" />
								<span className="hidden sm:inline">Delete</span>
							</Button>
						}
					/>
					<TooltipContent>Delete this asset</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
};

export { AssetActions };
