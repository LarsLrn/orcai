import type { Asset } from "@orcai/schema";
import {
	BookMarkedIcon,
	Calendar,
	Clock,
	ExternalLink,
	FileSpreadsheet,
	HardDrive,
	MoveHorizontalIcon,
	SignatureIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { getFileTypeLabel } from "@/lib/presentation/file-type";
import { formatFileSize } from "@/lib/presentation/format-file-size";
import { formatDisplayDate } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

const formatDate = (date: Date | null): string => {
	if (!date) return m.assets_meta_unknown_date();
	return formatDisplayDate(date);
};

const AssetMeta = ({ asset }: { asset: Asset }) => {
	const fileTypeLabel = getFileTypeLabel(asset.fileType);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center justify-between gap-2">
					{m.assets_meta_title()}
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
						<TooltipContent>{m.assets_meta_file_type_tooltip()}</TooltipContent>
					</Tooltip>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1">
					<div className="flex items-center gap-2">
						<Calendar className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">
							{m.assets_meta_created_label()}
						</span>
						<span className="font-medium">{formatDate(asset.createdAt)}</span>
					</div>

					<div className="flex items-center gap-2">
						<Clock className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">
							{m.assets_meta_updated_label()}
						</span>
						<span className="font-medium">{formatDate(asset.updatedAt)}</span>
					</div>

					<div className="flex items-center gap-2">
						<HardDrive className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">
							{m.assets_meta_size_label()}
						</span>
						<span className="font-medium">{formatFileSize(asset.size)}</span>
					</div>

					{asset.metadata.citationLabel && (
						<div className="flex items-center gap-2">
							<FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground">
								{m.assets_meta_citation_label()}
							</span>
							<span
								className="truncate font-medium text-xs"
								title={asset.metadata.citationLabel}
							>
								{asset.metadata.citationLabel}
							</span>
						</div>
					)}

					{asset.metadata.externalUrl && (
						<div className="flex items-center gap-2">
							<ExternalLink className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground">
								{m.assets_meta_source_url_label()}
							</span>
							<a
								href={asset.metadata.externalUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="truncate font-medium text-primary text-xs hover:underline"
								title={asset.metadata.externalUrl}
							>
								{m.assets_meta_view_source_link()}
							</a>
						</div>
					)}

					{asset.metadata.chapterTitle && (
						<div className="flex items-center gap-2">
							<BookMarkedIcon className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground">
								{m.assets_meta_chapter_label()}
							</span>
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
							<span className="text-muted-foreground">
								{m.assets_meta_page_range_label()}
							</span>
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
							<span className="text-muted-foreground">
								{m.assets_meta_author_label()}
							</span>
							<span
								className="truncate font-medium text-xs"
								title={asset.metadata.author}
							>
								{asset.metadata.author}
							</span>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
};

export { AssetMeta };
