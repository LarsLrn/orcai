import type { AssetFileType, AssetWithCapabilities } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { ExternalLinkIcon, FileTextIcon, ImageOffIcon } from "lucide-react";
import { useState } from "react";
import { Placeholder } from "@/components/placeholders/placeholder";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { openFreshUrl, type RefetchedUrl } from "@/lib/assets/open-fresh-url";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { AssetMeta } from "./asset-meta";
import { AssetProcessingCard } from "./asset-processing-card";

const FileViewer = ({ asset }: { asset: AssetWithCapabilities }) => {
	const isMobile = useIsMobile();

	const {
		data: file,
		status,
		refetch,
	} = useQuery(
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
		<div className="flex flex-col gap-4 md:h-[calc(100dvh-110px)]">
			<div className="flex size-full flex-col gap-4 xl:grid xl:grid-cols-4">
				<div className="size-full min-h-0 xl:col-span-3">
					<Viewport
						title={asset.title}
						fileType={asset.fileType}
						filePath={file.url}
						isMobile={isMobile}
						refetchUrl={refetch}
					/>
				</div>
				<div className="col-span-1 flex flex-col gap-4">
					<AssetMeta asset={asset} />
					<div className="mb-3 flex items-center gap-3">
						<AssetProcessingCard
							asset={asset}
							canEdit={hasCapability(asset.capabilities, "edit")}
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
	isMobile,
	refetchUrl,
}: {
	title: string;
	fileType: AssetFileType;
	filePath: string;
	isMobile: boolean;
	refetchUrl: () => Promise<RefetchedUrl>;
}) => {
	const [isLoading, setIsLoading] = useState(true);
	const [loadFailed, setLoadFailed] = useState(false);
	const [attempt, setAttempt] = useState(0);

	switch (fileType) {
		case "png":
		case "jpg":
		case "jpeg":
		case "gif":
		case "webp":
			if (loadFailed) {
				return (
					<Placeholder
						title={m.assets_file_viewer_image_error_title()}
						description={m.assets_file_viewer_image_error_description()}
						Icon={ImageOffIcon}
						actions={[
							{
								key: "retry",
								label: m.assets_file_viewer_image_retry(),
								onClick: () => {
									setLoadFailed(false);
									setIsLoading(true);
									setAttempt((n) => n + 1);
									void refetchUrl();
								},
							},
						]}
					/>
				);
			}
			return (
				<>
					{isLoading && (
						<div className="flex size-full items-center justify-center">
							<Spinner />
						</div>
					)}
					<Card
						className={cn(
							"h-fit max-h-full w-fit max-w-full items-center justify-center overflow-hidden",
							isLoading && "hidden",
						)}
					>
						<img
							key={attempt}
							src={filePath}
							alt={title}
							className="max-h-[70dvh] max-w-full object-contain md:max-h-[calc(100dvh-110px)]"
							loading="eager"
							onLoad={() => setIsLoading(false)}
							onError={() => setLoadFailed(true)}
						/>
					</Card>
				</>
			);
		case "pdf":
			if (isMobile) {
				return (
					<Placeholder
						title={m.assets_file_viewer_pdf_title()}
						description={m.assets_file_viewer_pdf_description()}
						Icon={FileTextIcon}
						actions={[
							{
								key: "open",
								label: m.assets_file_viewer_pdf_open(),
								icon: ExternalLinkIcon,
								variant: "default",
								size: "default",
								onClick: () => openFreshUrl(refetchUrl),
							},
						]}
					/>
				);
			}
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
