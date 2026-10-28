import {
	CalendarIcon,
	CheckIcon,
	ClockIcon,
	CopyIcon,
	GlobeIcon,
	HashIcon,
	LockIcon,
} from "lucide-react";
import { useCopyToClipboard } from "usehooks-ts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	formatDisplayDate,
	formatDisplayTimestamp,
} from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

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
			<TooltipContent>{m.app_metadata_card_copy_tooltip()}</TooltipContent>
		</Tooltip>
	);
};

const MetadataCard = ({
	id,
	visibility,
	createdAt,
	updatedAt,
}: {
	id?: string;
	visibility?: "public" | "private";
	createdAt?: Date | string | null;
	updatedAt?: Date | string | null;
}) => {
	const formatDate = (date: Date | string) => {
		const dateObj = typeof date === "string" ? new Date(date) : date;
		return formatDisplayTimestamp(dateObj);
	};

	const formatDateShort = (date: Date | string) => {
		const dateObj = typeof date === "string" ? new Date(date) : date;
		return formatDisplayDate(dateObj);
	};

	if (!createdAt && !updatedAt && !visibility && !id) {
		return null;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">
					{m.app_metadata_card_title()}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-2.5 text-sm">
					{id && (
						<div className="flex items-center justify-between gap-4">
							<div className="flex items-center gap-2 text-muted-foreground">
								<HashIcon className="size-3.5 shrink-0" />
								<span>{m.app_metadata_card_id_label()}</span>
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
								<span>{m.app_metadata_card_visibility_label()}</span>
							</div>
							<Badge
								variant={visibility === "public" ? "secondary" : "outline"}
							>
								{visibility === "public"
									? m.app_metadata_card_visibility_public()
									: m.app_metadata_card_visibility_private()}
							</Badge>
						</div>
					)}
					{(id || visibility) && (createdAt || updatedAt) && (
						<div className="mt-8" />
					)}
					{createdAt && (
						<div className="flex items-center justify-between gap-4">
							<div className="flex items-center gap-2 text-muted-foreground">
								<CalendarIcon className="size-3.5 shrink-0" />
								<span>{m.app_metadata_card_created_label()}</span>
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
								<span>{m.app_metadata_card_updated_label()}</span>
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
