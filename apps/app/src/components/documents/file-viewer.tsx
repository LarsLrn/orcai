import type { Asset, AssetFileType } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { SmartphoneIcon } from "lucide-react";
import { useState } from "react";
import { JobStatusPanel } from "@/components/jobs/job-status-panel";
import { Placeholder } from "@/components/placeholders/placeholder";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
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
				title={m.assets_file_viewer_error_title()}
				description={m.assets_file_viewer_error_description()}
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
							title={m.assets_file_viewer_mobile_title()}
							description={m.assets_file_viewer_mobile_description()}
							Icon={SmartphoneIcon}
						/>
					) : (
						<Viewport
							title={asset.title}
							fileType={asset.fileType}
							filePath={file.url}
						/>
					)}
				</div>
				<div className="col-span-1 flex flex-col gap-4">
					<AssetMeta asset={asset} />
					<div className="mb-3 flex items-center gap-3">
						<JobStatusPanel
							processingStatus={asset.processingStatus}
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
	title,
	fileType,
	filePath,
	className,
}: {
	title: string;
	fileType: AssetFileType;
	filePath: string;
	className?: string;
}) => {
	const [isLoading, setIsLoading] = useState(true);

	switch (fileType) {
		case "png":
		case "jpg":
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
							alt={title}
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
					title={m.assets_file_viewer_unsupported_title()}
					description={m.assets_file_viewer_unsupported_description()}
				/>
			);
	}
};

export { FileViewer };
