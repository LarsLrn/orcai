"use client";

import { useQuery } from "@tanstack/react-query";
import { SmartphoneIcon } from "lucide-react";
import { useState } from "react";
import { Placeholder } from "@/components/placeholders/placeholder";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { Document } from "@/db/schema/document";
import { useIsMobile } from "@/hooks/use-mobile";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { FileActions } from "./file-actions";
import { FileMeta } from "./file-meta";

const FileViewer = ({ document }: { document: Document }) => {
	const isMobile = useIsMobile();
	const { data, status, error } = useQuery(
		orpc.storage.createDownloadUrl.queryOptions({
			input: {
				id: document.id,
				prefix: document.prefix,
				bucket: document.bucket,
				type: document.fileType,
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
				<p>Error loading document: {error.message}</p>
			</Placeholder>
		);
	}

	return (
		<div className="flex h-[calc(100dvh-110px)] flex-col gap-4">
			<div className="flex items-center justify-between">
				<h3
					className="max-w-[80%] truncate font-semibold text-lg"
					title={document.title}
				>
					{document.title}
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
							Document preview is not available on mobile.
						</Placeholder>
					) : (
						<Viewport fileType={document.fileType} filePath={data.url} />
					)}
				</div>
				<div className="col-span-1 flex flex-col gap-4">
					<FileMeta document={document} />
					<FileActions fileInfo={document} filePath={data.url} />
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
