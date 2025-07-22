import { useQuery } from "@tanstack/react-query";
import { SmartphoneIcon } from "lucide-react";
import { useState } from "react";
import { Placeholder } from "@/components/placeholders/placeholder";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { Asset } from "@/db/schema/asset";
import { useIsMobile } from "@/hooks/use-mobile";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { AssetActions } from "./asset-actions";
import { AssetMeta } from "./asset-meta";

const FileViewer = ({ asset }: { asset: Asset }) => {
	const isMobile = useIsMobile();
	const { data, status, error } = useQuery(
		orpc.storage.createDownloadUrl.queryOptions({
			input: {
				id: asset.id,
				prefix: asset.prefix,
				bucket: asset.bucket,
				type: asset.fileType,
			},
			queryKey: orpc.storage.createDownloadUrl.key(),
		}),
	);

	if (status === "pending") {
		return (
			<div className="flex size-full items-center justify-center">
				<LoadingSpinner />
			</div>
		);
	}

	if (status === "error") {
		return (
			<Placeholder>
				<p>Error loading asset: {error.message}</p>
			</Placeholder>
		);
	}

	return (
		<div className="flex h-[calc(100dvh-110px)] flex-col gap-4">
			<div className="flex items-center justify-between">
				<h3
					className="max-w-[80%] truncate font-semibold text-lg"
					title={asset.title}
				>
					{asset.title}
				</h3>
			</div>
			<div
				className={cn(
					"flex size-full flex-col gap-4 xl:grid xl:grid-cols-4",
					isMobile && "flex-col-reverse",
				)}
			>
				<div className="size-full xl:col-span-3">
					{isMobile ? (
						<Placeholder Icon={SmartphoneIcon} size={30}>
							Asset preview is not available on mobile.
						</Placeholder>
					) : (
						<Viewport fileType={asset.fileType} filePath={data.url} />
					)}
				</div>
				<div className="col-span-1 flex flex-col gap-4">
					<AssetMeta asset={asset} />
					<AssetActions assetInfo={asset} filePath={data.url} />
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

	switch (fileType) {
		case "image":
			return (
				<>
					{isLoading && (
						<div className="flex size-full items-center justify-center">
							<LoadingSpinner />
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
		case "video":
			return (
				<Card className="h-full overflow-hidden">
					<iframe title={filePath} src={filePath} className="size-full" />
				</Card>
			);
		default:
			return (
				<Placeholder>
					<p>This file type cannot be displayed in the browser.</p>
					<p>Please download it instead.</p>
				</Placeholder>
			);
	}
};

export { FileViewer };
