import { convert } from "convert";
import { formatDistanceToNow } from "date-fns";
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
import type { Document } from "@/db/schema/document";

const getFileTypeColor = (fileType: string): string => {
	const typeMap: Record<string, string> = {
		pdf: "bg-red-100 text-red-800",
		doc: "bg-blue-100 text-blue-800",
		docx: "bg-blue-100 text-blue-800",
		txt: "bg-gray-100 text-gray-800",
		csv: "bg-green-100 text-green-800",
		xls: "bg-green-100 text-green-800",
		xlsx: "bg-green-100 text-green-800",
		ppt: "bg-orange-100 text-orange-800",
		pptx: "bg-orange-100 text-orange-800",
		jpg: "bg-purple-100 text-purple-800",
		png: "bg-purple-100 text-purple-800",
	};

	return typeMap[fileType.toLowerCase()] || "bg-zinc-100 text-zinc-800";
};

const formatDate = (date: Date | null): string => {
	if (!date) return "Unknown date";
	return formatDistanceToNow(date, { addSuffix: true });
};

const getRelevanceBadgeColor = (relevance: string): string => {
	const relevanceMap: Record<string, string> = {
		high: "bg-green-100 text-green-800",
		medium: "bg-yellow-100 text-yellow-800",
		low: "bg-red-100 text-red-800",
	};

	return relevanceMap[relevance.toLowerCase()] || "bg-zinc-100 text-zinc-800";
};

const FileMeta = ({ document }: { document: Document }) => {
	const fileTypeColor = getFileTypeColor(document.fileType);
	const relevanceBadgeColor = getRelevanceBadgeColor(
		document.metadata.relevance,
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center justify-between gap-2">
					Metadata
					<Tooltip>
						<TooltipTrigger asChild>
							<Badge
								className={`${fileTypeColor} font-medium text-xs uppercase`}
							>
								{document.fileType}
							</Badge>
						</TooltipTrigger>
						<TooltipContent>File Type</TooltipContent>
					</Tooltip>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1">
					<div className="flex items-center gap-2">
						<Calendar className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">Created:</span>
						<span className="font-medium">
							{formatDate(document.createdAt)}
						</span>
					</div>

					<div className="flex items-center gap-2">
						<Clock className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">Updated:</span>
						<span className="font-medium">
							{formatDate(document.updatedAt)}
						</span>
					</div>

					<div className="flex items-center gap-2">
						<HardDrive className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">Size:</span>
						<span className="font-medium">
							{convert(document.size, "bytes").to("best").toString()}
						</span>
					</div>

					<div className="flex items-center gap-2">
						<Star className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">Relevance:</span>
						<Badge className={`${relevanceBadgeColor} font-normal text-xs`}>
							{document.metadata.relevance.charAt(0).toUpperCase() +
								document.metadata.relevance.slice(1)}
						</Badge>
					</div>

					{document.metadata.citation && (
						<div className="flex items-center gap-2">
							<FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground">Citation:</span>
							<span
								className="truncate font-medium text-xs"
								title={document.metadata.citation}
							>
								{document.metadata.citation}
							</span>
						</div>
					)}

					{document.metadata.externalUrl && (
						<div className="flex items-center gap-2">
							<ExternalLink className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground">External:</span>
							<a
								href={document.metadata.externalUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="truncate font-medium text-primary text-xs hover:underline"
								title={document.metadata.externalUrl}
							>
								View source
							</a>
						</div>
					)}

					{document.metadata.chapterTitle && (
						<div className="flex items-center gap-2">
							<BookMarkedIcon className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground">Chapter:</span>
							<span
								className="truncate font-medium text-xs"
								title={document.metadata.chapterTitle}
							>
								{document.metadata.chapterTitle}
							</span>
						</div>
					)}

					{document.metadata.pageRange && (
						<div className="flex items-center gap-2">
							<MoveHorizontalIcon className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground">Page Range:</span>
							<span
								className="truncate font-medium text-xs"
								title={document.metadata.pageRange}
							>
								{document.metadata.pageRange}
							</span>
						</div>
					)}

					{document.metadata.author && (
						<div className="flex items-center gap-2">
							<SignatureIcon className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground">Author(s):</span>
							<span
								className="truncate font-medium text-xs"
								title={document.metadata.author}
							>
								{document.metadata.author}
							</span>
						</div>
					)}
				</div>

				<div className="mt-4 flex flex-wrap gap-2">
					<Badge variant="outline" className="font-normal text-xs">
						{document.status}
					</Badge>

					<Badge
						variant={document.metadata.showReference ? "default" : "outline"}
						className="font-normal text-xs"
					>
						{document.metadata.showReference
							? "Reference Shown"
							: "Reference Hidden"}
					</Badge>
				</div>
			</CardContent>
		</Card>
	);
};

export { FileMeta };
