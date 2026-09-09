import type { Asset } from "@orcai/schema";
import { convert } from "convert";
import {
	BookMarkedIcon,
	Calendar,
	Clock,
	ExternalLink,
	FileSpreadsheet,
	HardDrive,
	MoveHorizontalIcon,
	SignatureIcon,
	Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { getFileTypeLabel } from "@/lib/presentation/file-type";
import { formatDisplayDate } from "@/lib/presentation/format-timestamp";

const formatDate = (date: Date | null): string => {
	if (!date) return "Unknown date";
	return formatDisplayDate(date);
};

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const RELEVANCE_VARIANT: Record<string, BadgeVariant> = {
	high: "success",
	medium: "warning",
	low: "danger",
};

const getRelevanceVariant = (relevance: string): BadgeVariant =>
	RELEVANCE_VARIANT[relevance.toLowerCase()] ?? "outline";

const AssetMeta = ({ asset }: { asset: Asset }) => {
	const fileTypeLabel = getFileTypeLabel(asset.fileType);
	const relevanceVariant = getRelevanceVariant(asset.metadata.relevance);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center justify-between gap-2">
					Metadata
					<Tooltip>
						<TooltipTrigger
							render={
								<Badge
									variant="outline"
									className="font-medium text-xs uppercase"
								>
									{fileTypeLabel}
								</Badge>
							}
						/>
						<TooltipContent>File type</TooltipContent>
					</Tooltip>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1">
					<div className="flex items-center gap-2">
						<Calendar className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">Created:</span>
						<span className="font-medium">{formatDate(asset.createdAt)}</span>
					</div>

					<div className="flex items-center gap-2">
						<Clock className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">Updated:</span>
						<span className="font-medium">{formatDate(asset.updatedAt)}</span>
					</div>

					<div className="flex items-center gap-2">
						<HardDrive className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">Size:</span>
						<span className="font-medium">
							{convert(asset.size, "bytes").to("best").toString(2)}
						</span>
					</div>

					<div className="flex items-center gap-2">
						<Star className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">Relevance:</span>
						<Badge variant={relevanceVariant} className="font-normal text-xs">
							{asset.metadata.relevance.charAt(0).toUpperCase() +
								asset.metadata.relevance.slice(1)}
						</Badge>
					</div>

					{asset.metadata.citation && (
						<div className="flex items-center gap-2">
							<FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground">Citation:</span>
							<span
								className="truncate font-medium text-xs"
								title={asset.metadata.citation}
							>
								{asset.metadata.citation}
							</span>
						</div>
					)}

					{asset.metadata.externalUrl && (
						<div className="flex items-center gap-2">
							<ExternalLink className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground">Source URL:</span>
							<a
								href={asset.metadata.externalUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="truncate font-medium text-primary text-xs hover:underline"
								title={asset.metadata.externalUrl}
							>
								View source
							</a>
						</div>
					)}

					{asset.metadata.chapterTitle && (
						<div className="flex items-center gap-2">
							<BookMarkedIcon className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground">Chapter:</span>
							<span
								className="truncate font-medium text-xs"
								title={asset.metadata.chapterTitle}
							>
								{asset.metadata.chapterTitle}
							</span>
						</div>
					)}

					{asset.metadata.pageRange && (
						<div className="flex items-center gap-2">
							<MoveHorizontalIcon className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground">Page range:</span>
							<span
								className="truncate font-medium text-xs"
								title={asset.metadata.pageRange}
							>
								{asset.metadata.pageRange}
							</span>
						</div>
					)}

					{asset.metadata.author && (
						<div className="flex items-center gap-2">
							<SignatureIcon className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground">Author(s):</span>
							<span
								className="truncate font-medium text-xs"
								title={asset.metadata.author}
							>
								{asset.metadata.author}
							</span>
						</div>
					)}
				</div>

				<div className="mt-4 flex flex-wrap gap-2">
					{/* <Badge variant="outline" className="font-normal text-xs">
						{asset.status}
					</Badge> */}

					<Badge
						variant={asset.metadata.showReference ? "default" : "outline"}
						className="font-normal text-xs"
					>
						{asset.metadata.showReference
							? "AI may cite this source"
							: "Keep this source out of citations"}
					</Badge>
				</div>
			</CardContent>
		</Card>
	);
};

export { AssetMeta };
