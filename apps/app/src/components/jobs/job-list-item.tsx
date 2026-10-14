import type { JobHistoryEntry } from "@orcai/schema";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

const stateVariant: Record<
	JobHistoryEntry["state"],
	"default" | "secondary" | "destructive" | "outline"
> = {
	created: "outline",
	retry: "outline",
	active: "secondary",
	completed: "default",
	cancelled: "outline",
	failed: "destructive",
};

const showSpinner = (state: JobHistoryEntry["state"]) => {
	return state === "created" || state === "active" || state === "retry";
};

const JobListItem = ({ job }: { job: JobHistoryEntry }) => {
	return (
		<div className="flex items-center justify-between gap-4 rounded-md border p-3">
			<div className="flex flex-col gap-1 text-sm">
				<span className="font-medium">{job.name}</span>
				<span className="text-muted-foreground text-xs">
					{m.jobs_list_item_created_label({
						timestamp: formatDisplayTimestamp(job.createdOn),
					})}
					{job.startedOn &&
						` ${m.jobs_list_item_started_label({
							timestamp: formatDisplayTimestamp(job.startedOn),
						})}`}
					{job.completedOn &&
						` ${m.jobs_list_item_completed_label({
							timestamp: formatDisplayTimestamp(job.completedOn),
						})}`}
				</span>
				{job.retryCount > 0 && (
					<span className="text-muted-foreground text-xs">
						{m.jobs_list_item_retries_label({
							count: job.retryCount,
							limit: job.retryLimit,
						})}
					</span>
				)}
			</div>
			<Badge variant={stateVariant[job.state]}>
				{showSpinner(job.state) ? (
					<span className="flex items-center gap-1">
						<Spinner className="h-3 w-3" />
						{job.state}
					</span>
				) : (
					job.state
				)}
			</Badge>
		</div>
	);
};

export { JobListItem };
