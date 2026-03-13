import { Badge } from "@/components/ui/badge";
import type { Job } from "@/lib/pg-boss/schema/job";

const stateVariant: Record<
	Job["state"],
	"default" | "secondary" | "destructive" | "outline"
> = {
	created: "outline",
	retry: "outline",
	active: "secondary",
	completed: "default",
	cancelled: "outline",
	failed: "destructive",
};

const JobListItem = ({ job }: { job: Job }) => {
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
			<Badge variant={stateVariant[job.state]}>{job.state}</Badge>
		</div>
	);
};

export { JobListItem };
