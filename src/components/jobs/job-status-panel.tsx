import { RefreshCwIcon } from "lucide-react";
import { JobListDialog } from "@/components/jobs/job-list-dialog";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	useRetryProcessingMutation,
	useRetryVectorizationMutation,
} from "@/hooks/mutations/use-job-mutations";
import type { ProcessingStatus } from "@/lib/orpc/schemas/fragments/processing-status";
import type { JobQueue } from "@/lib/pg-boss/schema/job-queues";
import { getProcessingStatusDescription } from "@/lib/presentation/processing-status";
import { cn } from "@/lib/utils";

type JobStatusPanelProps = {
	processingStatus: ProcessingStatus;
	jobQueue: JobQueue;
	resourceId: string;
	resourceType: "block" | "asset";
	/** For retry — required when resourceType is "asset" */
	assetId?: string;
	/** For retry — required when resourceType is "block" */
	blockId?: string;
	/** Optional filter for the job list dialog */
	assetIdFilter?: string;
	className?: string;
};

const JobStatusPanel = ({
	processingStatus,
	jobQueue,
	resourceId,
	resourceType,
	assetId,
	blockId,
	assetIdFilter,
	className,
}: JobStatusPanelProps) => {
	const { mutate: retryProcessing } = useRetryProcessingMutation();
	const { mutate: retryVectorization } = useRetryVectorizationMutation();

	const showRetry = processingStatus === "failed";

	const handleRetry = () => {
		if (resourceType === "asset" && assetId) {
			retryProcessing({
				assetId,
			});
		} else if (resourceType === "block" && blockId && assetId) {
			retryVectorization({
				blockId,
				assetId,
			});
		}
	};

	return (
		<Card className={cn(className)}>
			<CardHeader>
				<CardTitle>Preparation Status</CardTitle>
				<CardDescription>
					Content is prepared in background jobs after upload so it is ready for
					search, retrieval, and citations.{" "}
					{getProcessingStatusDescription(processingStatus)}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex items-center gap-2">
				<JobStatusBadge status={processingStatus} className="h-8" />
				<JobListDialog
					jobQueue={jobQueue}
					resourceId={resourceId}
					resourceType={resourceType}
					assetIdFilter={assetIdFilter}
				/>
				{showRetry && (
					<Button variant="outline" size="sm" onClick={handleRetry}>
						<RefreshCwIcon className="mr-1 h-3 w-3" />
						Retry
					</Button>
				)}
			</CardContent>
		</Card>
	);
};

export { JobStatusPanel };
