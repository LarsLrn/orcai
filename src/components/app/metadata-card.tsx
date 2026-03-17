import { format } from "date-fns";
import {
	CalendarIcon,
	CheckIcon,
	ClockIcon,
	CopyIcon,
	GlobeIcon,
	HashIcon,
	LockIcon,
	MilestoneIcon,
} from "lucide-react";
import { useCopyToClipboard } from "usehooks-ts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

const CopyableId = ({ value }: { value: string }) => {
	const [copiedValue, copy] = useCopyToClipboard();

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						type="button"
						onClick={() => copy(value)}
						className="group flex min-w-0 items-center gap-1.5 font-mono text-muted-foreground text-xs transition-colors hover:text-foreground"
					>
						<span className="truncate">{value}</span>
						{copiedValue ? (
							<CheckIcon className="size-3 shrink-0" />
						) : (
							<CopyIcon className="size-3 shrink-0" />
						)}
					</button>
				}
			/>
			<TooltipContent>Click to copy</TooltipContent>
		</Tooltip>
	);
};

const MetadataCard = ({
	id,
	version,
	visibility,
	createdAt,
	updatedAt,
}: {
	id?: string;
	version?: number;
	visibility?: "public" | "private";
	createdAt?: Date | string | null;
	updatedAt?: Date | string | null;
}) => {
	const formatDate = (date: Date | string) => {
		const dateObj = typeof date === "string" ? new Date(date) : date;
		return format(dateObj, "PPP 'at' p");
	};

	const formatDateShort = (date: Date | string) => {
		const dateObj = typeof date === "string" ? new Date(date) : date;
		return format(dateObj, "PP");
	};

	if (!createdAt && !updatedAt && !visibility && !version && !id) {
		return null;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Metadata</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-2.5 text-sm">
					{id && (
						<div className="flex items-center justify-between gap-4">
							<div className="flex items-center gap-2 text-muted-foreground">
								<HashIcon className="size-3.5 shrink-0" />
								<span>ID</span>
							</div>
							<CopyableId value={id} />
						</div>
					)}
					{visibility && (
						<div className="flex items-center justify-between gap-4">
							<div className="flex items-center gap-2 text-muted-foreground">
								{visibility === "public" ? (
									<GlobeIcon className="size-3.5 shrink-0" />
								) : (
									<LockIcon className="size-3.5 shrink-0" />
								)}
								<span>Visibility</span>
							</div>
							<Badge
								variant={visibility === "public" ? "secondary" : "outline"}
							>
								{visibility === "public" ? "Public" : "Private"}
							</Badge>
						</div>
					)}
					{version !== undefined && (
						<div className="flex items-center justify-between gap-4">
							<div className="flex items-center gap-2 text-muted-foreground">
								<MilestoneIcon className="size-3.5 shrink-0" />
								<span>Version</span>
							</div>
							<Badge variant="outline">v{version}</Badge>
						</div>
					)}
					{(id || visibility || version !== undefined) &&
						(createdAt || updatedAt) && <div className="mt-8" />}
					{createdAt && (
						<div className="flex items-center justify-between gap-4">
							<div className="flex items-center gap-2 text-muted-foreground">
								<CalendarIcon className="size-3.5 shrink-0" />
								<span>Created</span>
							</div>
							<Tooltip>
								<TooltipTrigger className="text-right text-muted-foreground text-xs">
									{formatDateShort(createdAt)}
								</TooltipTrigger>
								<TooltipContent>{formatDate(createdAt)}</TooltipContent>
							</Tooltip>
						</div>
					)}
					{updatedAt && (
						<div className="flex items-center justify-between gap-4">
							<div className="flex items-center gap-2 text-muted-foreground">
								<ClockIcon className="size-3.5 shrink-0" />
								<span>Updated</span>
							</div>
							<Tooltip>
								<TooltipTrigger className="text-right text-muted-foreground text-xs">
									{formatDateShort(updatedAt)}
								</TooltipTrigger>
								<TooltipContent>{formatDate(updatedAt)}</TooltipContent>
							</Tooltip>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
};

export { MetadataCard };
