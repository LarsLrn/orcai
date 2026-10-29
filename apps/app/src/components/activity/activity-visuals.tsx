import type { ActivityRun } from "@orcai/schema";
import {
	CircleAlertIcon,
	DownloadIcon,
	RotateCwIcon,
	SparklesIcon,
	UploadIcon,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const KIND_ICONS = {
	upload: UploadIcon,
	fill_metadata: SparklesIcon,
	suggest_metadata: SparklesIcon,
	retry: RotateCwIcon,
	export: DownloadIcon,
} satisfies Record<ActivityRun["kind"], typeof UploadIcon>;

const STATE_WELLS = {
	running: "bg-status-processing/12 text-status-processing",
	finished: "bg-status-success/12 text-status-success",
	resolved: "bg-status-success/12 text-status-success",
	failed: "bg-status-danger/12 text-status-danger",
	expired: "bg-muted text-muted-foreground",
} satisfies Record<ActivityRun["state"], string>;

const well =
	"flex size-8 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4";

/** The entry's kind, tinted by how it went. */
export const RunWell = ({ run }: { run: ActivityRun }) => {
	const Icon = KIND_ICONS[run.kind];
	return (
		<span className={cn(well, STATE_WELLS[run.state])}>
			<Icon aria-hidden="true" />
		</span>
	);
};

export const AttentionWell = ({
	kind,
	className,
}: {
	kind: "suggestions" | "failure";
	className?: string;
}) =>
	kind === "suggestions" ? (
		<span className={cn(well, "bg-status-info/12 text-status-info", className)}>
			<SparklesIcon aria-hidden="true" />
		</span>
	) : (
		<span
			className={cn(well, "bg-status-danger/12 text-status-danger", className)}
		>
			<CircleAlertIcon aria-hidden="true" />
		</span>
	);

/** A thin bar for a running entry's progress. */
export const RunProgress = ({
	run,
	label,
	className,
}: {
	run: ActivityRun;
	label: string;
	className?: string;
}) => (
	<Progress
		value={run.progress.done}
		max={Math.max(run.progress.total, 1)}
		aria-label={label}
		className={cn(
			"[&_[data-slot=progress-indicator]]:bg-status-processing [&_[data-slot=progress-track]]:h-1.5",
			className,
		)}
	/>
);
