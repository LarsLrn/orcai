import convert from "convert";
import { formatDistanceToNow } from "date-fns";
import { CalendarIcon, HardDriveIcon, SparklesIcon } from "lucide-react";
import type { Asset } from "@/lib/orpc/schemas/asset";
import { getFileTypeFromMime } from "@/lib/s3/upload-helpers";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

/** --- Utility --- */
const fileTypeClass = (ext: string): string => {
	const map: Record<string, string> = {
		pdf: "bg-red-100 text-red-700 ring-1 ring-red-200",
		doc: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
		docx: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200",
		txt: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
		csv: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
		xls: "bg-green-100 text-green-700 ring-1 ring-green-200",
		xlsx: "bg-teal-100 text-teal-700 ring-1 ring-teal-200",
		ppt: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",
		pptx: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
		jpg: "bg-purple-100 text-purple-700 ring-1 ring-purple-200",
		jpeg: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
		png: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",
		md: "bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200",
		unknown: "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200",
	};

	return map[ext.toLowerCase()] ?? map.unknown;
};

const InfoRow = ({
	icon,
	label,
	value,
}: {
	icon: React.ReactNode;
	label: string;
	value: React.ReactNode;
}) => (
	<div className="flex items-center gap-2 text-sm">
		<div className="text-muted-foreground">{icon}</div>
		<div className="text-muted-foreground">{label}:</div>
		<div className="truncate font-medium">{value}</div>
	</div>
);

const AssetPreview = ({ asset }: { asset: Asset }) => {
	const ext = getFileTypeFromMime(asset.fileType) || "unknown";

	return (
		<Card className="h-full">
			<CardHeader className="pb-2">
				<div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
					<CardTitle className="line-clamp-2 break-words text-base leading-tight">
						{asset.title}
					</CardTitle>
					<Badge className={`${fileTypeClass(ext)} capitalize`}>{ext}</Badge>
				</div>
				{asset.metadata?.relevance && (
					<div className="mt-2 flex items-center gap-2">
						<SparklesIcon className="h-3.5 w-3.5 text-emerald-600" />
						<Badge variant="outline" className="text-xs">
							Relevance:{" "}
							{asset.metadata.relevance.charAt(0).toUpperCase() +
								asset.metadata.relevance.slice(1)}
						</Badge>
					</div>
				)}
			</CardHeader>
			<CardContent className="space-y-3 pt-0">
				<InfoRow
					icon={<HardDriveIcon className="h-4 w-4" />}
					label="Size"
					value={convert(asset.size, "bytes").to("best").toString(0)}
				/>
				<InfoRow
					icon={<CalendarIcon className="h-4 w-4" />}
					label="Created"
					value={
						asset.createdAt
							? formatDistanceToNow(asset.createdAt, { addSuffix: true })
							: "Unknown"
					}
				/>
			</CardContent>
		</Card>
	);
};

export { AssetPreview };
