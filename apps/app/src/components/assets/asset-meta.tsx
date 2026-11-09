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
import { useDisplayTime } from "@/hooks/use-display-time";
import { getFileTypeLabel } from "@/lib/labels/file-type";
import { formatFileSize } from "@/lib/locale/format-file-size";
import { m } from "@/paraglide/messages";

const AssetMeta = ({ asset }: { asset: Asset }) => {
	const displayTime = useDisplayTime();
	const formatDate = (date: Date | null) =>
		date ? displayTime.date(date) : m.assets_meta_unknown_date();
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
									className="text-xs font-medium uppercase"
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
						<Calendar className="text-muted-foreground h-4 w-4" />
						<span className="text-muted-foreground">
							{m.assets_meta_created_label()}
						</span>
						<span className="font-medium">{formatDate(asset.createdAt)}</span>
					</div>

					<div className="flex items-center gap-2">
						<Clock className="text-muted-foreground h-4 w-4" />
						<span className="text-muted-foreground">
							{m.assets_meta_updated_label()}
						</span>
						<span className="font-medium">{formatDate(asset.updatedAt)}</span>
					</div>

					<div className="flex items-center gap-2">
						<HardDrive className="text-muted-foreground h-4 w-4" />
						<span className="text-muted-foreground">
							{m.assets_meta_size_label()}
						</span>
						<span className="font-medium">{formatFileSize(asset.size)}</span>
					</div>

					{asset.metadata.citationLabel && (
						<div className="flex items-center gap-2">
							<FileSpreadsheet className="text-muted-foreground h-4 w-4" />
							<span className="text-muted-foreground">
								{m.assets_meta_citation_label()}
							</span>
							<span
								className="truncate text-xs font-medium"
								title={asset.metadata.citationLabel}
							>
								{asset.metadata.citationLabel}
							</span>
						</div>
					)}

					{asset.metadata.externalUrl && (
						<div className="flex items-center gap-2">
							<ExternalLink className="text-muted-foreground h-4 w-4" />
							<span className="text-muted-foreground">
								{m.assets_meta_source_url_label()}
							</span>
							<a
								href={asset.metadata.externalUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary truncate text-xs font-medium hover:underline"
								title={asset.metadata.externalUrl}
							>
								{m.assets_meta_view_source_link()}
							</a>
						</div>
					)}

					{asset.metadata.chapterTitle && (
						<div className="flex items-center gap-2">
							<BookMarkedIcon className="text-muted-foreground h-4 w-4" />
							<span className="text-muted-foreground">
								{m.assets_meta_chapter_label()}
							</span>
							<span
								className="truncate text-xs font-medium"
								title={asset.metadata.chapterTitle}
							>
								{asset.metadata.chapterTitle}
							</span>
						</div>
					)}

					{asset.metadata.pageRange && (
						<div className="flex items-center gap-2">
							<MoveHorizontalIcon className="text-muted-foreground h-4 w-4" />
							<span className="text-muted-foreground">
								{m.assets_meta_page_range_label()}
							</span>
							<span
								className="truncate text-xs font-medium"
								title={asset.metadata.pageRange}
							>
								{asset.metadata.pageRange}
							</span>
						</div>
					)}

					{asset.metadata.author && (
						<div className="flex items-center gap-2">
							<SignatureIcon className="text-muted-foreground h-4 w-4" />
							<span className="text-muted-foreground">
								{m.assets_meta_author_label()}
							</span>
							<span
								className="truncate text-xs font-medium"
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
