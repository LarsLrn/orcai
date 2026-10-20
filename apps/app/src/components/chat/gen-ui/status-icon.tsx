import {
	CircleCheckIcon,
	CircleDashedIcon,
	CircleMinusIcon,
	CircleXIcon,
	type LucideIcon,
	TriangleAlertIcon,
} from "lucide-react";
import {
	type Status,
	statusLabel,
	tally,
} from "@/components/chat/gen-ui/status";
import { cn } from "@/lib/utils";

export const statusTone: Record<Status, string> = {
	met: "text-status-success",
	partial: "text-status-warning",
	not_met: "text-status-danger",
	n_a: "text-muted-foreground",
};

const statusIcon: Record<Status, LucideIcon> = {
	met: CircleCheckIcon,
	partial: TriangleAlertIcon,
	not_met: CircleXIcon,
	n_a: CircleMinusIcon,
};

/**
 * The icon for `status`; without one, a pulsing placeholder when `pending`
 * and an empty spacer of the same size otherwise.
 */
export const StatusIcon = ({
	status,
	pending = false,
	className,
}: {
	status?: Status;
	pending?: boolean;
	className?: string;
}) => {
	if (status) {
		const Icon = statusIcon[status];
		return (
			<Icon
				role="img"
				aria-label={statusLabel(status)}
				data-status={status}
				className={cn("size-4 shrink-0", statusTone[status], className)}
			/>
		);
	}
	if (pending) {
		return (
			<CircleDashedIcon
				aria-hidden
				data-status="pending"
				className={cn(
					"size-4 shrink-0 animate-pulse text-muted-foreground",
					className,
				)}
			/>
		);
	}
	return <span aria-hidden className={cn("size-4 shrink-0", className)} />;
};

export const Tally = ({
	statuses,
	className,
}: {
	statuses: readonly (Status | undefined)[];
	className?: string;
}) => (
	<div className={cn("flex shrink-0 items-center gap-2.5 text-xs", className)}>
		{tally(statuses).map(({ status, count }) => (
			<span
				key={status}
				className={cn("flex items-center gap-1", statusTone[status])}
			>
				<StatusIcon status={status} className="size-3.5" />
				{count}
			</span>
		))}
	</div>
);
