import { useQuery } from "@tanstack/react-query";
import { SmartphoneIcon } from "lucide-react";
import { useState } from "react";
import { JobStatusPanel } from "@/components/jobs/job-status-panel";
import { Placeholder } from "@/components/placeholders/placeholder";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { orpc } from "@/lib/orpc/orpc";
import type { Asset } from "@/lib/orpc/schemas/asset";
import { getFileTypeFromMime } from "@/lib/s3/utils/file-type-helpers";
import { cn } from "@/lib/utils";
import { AssetMeta } from "./asset-meta";

const FileViewer = ({ asset }: { asset: Asset }) => {
	const isMobile = useIsMobile();

	const { data: file, status } = useQuery(
		orpc.storage.createDownloadUrl.queryOptions({
			input: {
				id: asset.id,
			},
		}),
	);

	if (status === "pending") {
		return (
			<div className="flex size-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	if (status === "error") {
		return (
			<Placeholder
				title="Error"
				description="There was an error loading this content item. Please try again later."
			/>
		);
	}

	return (
		<div className="flex h-[calc(100dvh-110px)] flex-col gap-4">
			<div
				className={cn(
					"flex size-full flex-col gap-4 xl:grid xl:grid-cols-4",
					isMobile && "flex-col-reverse",
				)}
			>
				<div className="size-full xl:col-span-3">
					{isMobile ? (
						<Placeholder
							title="Mobile Preview Unavailable"
							description="Content preview is not available on mobile."
							Icon={SmartphoneIcon}
						/>
					) : (
						<Viewport fileType={asset.fileType} filePath={file.url} />
					)}
				</div>
				<div className="col-span-1 flex flex-col gap-4">
					<AssetMeta asset={asset} />
					<div className="mb-3 flex items-center gap-3">
						<JobStatusPanel
							processingStatus={asset.processingStatus}
							jobQueue="process-asset-job"
							resourceId={asset.id}
							resourceType="asset"
							assetId={asset.id}
							className="w-full"
						/>
					</div>
				</div>
			</div>
		</div>
	);
};

const Viewport = ({
	fileType,
	filePath,
	className,
}: {
	fileType: string;
	filePath: string;
	className?: string;
}) => {
	const [isLoading, setIsLoading] = useState(true);

	const extension = getFileTypeFromMime(fileType);

	switch (extension) {
		case "png":
		case "jpeg":
			return (
				<>
					{isLoading && (
						<div className="flex size-full items-center justify-center">
							<Spinner />
						</div>
					)}
					<Card
						className={cn(
							className,
							"h-fit max-h-full w-auto items-center justify-center overflow-hidden",
							isLoading && "hidden",
						)}
					>
						<img
							src={filePath}
							alt="test" // FIXME: Add proper alt text
							width={1000}
							height={500}
							className={cn("w-auto object-contain")}
							loading="eager"
							onLoad={() => setIsLoading(false)}
						/>
					</Card>
				</>
			);
		case "pdf":
			return (
				<Card className="h-full overflow-hidden">
					<iframe title={filePath} src={filePath} className="size-full" />
				</Card>
			);
		default:
			return (
				<Placeholder
					title="Unsupported File Type"
					description="This file type cannot be displayed in the browser. Please download it instead."
				/>
			);
	}
};

export { FileViewer };
