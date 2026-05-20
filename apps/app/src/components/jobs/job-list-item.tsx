import type { JobHistoryEntry } from "@orcai/schema";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

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
					Created: {new Date(job.createdOn).toLocaleString()}
					{job.startedOn &&
						` · Started: ${new Date(job.startedOn).toLocaleString()}`}
					{job.completedOn &&
						` · Done: ${new Date(job.completedOn).toLocaleString()}`}
				</span>
				{job.retryCount > 0 && (
					<span className="text-muted-foreground text-xs">
						Retries: {job.retryCount}/{job.retryLimit}
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
