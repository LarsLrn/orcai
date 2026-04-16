import type { AssetId, BlockId } from "@orcai/core";
import type { JobQueue, ProcessingStatus } from "@orcai/schema";
import { RefreshCwIcon } from "lucide-react";
import { JobListDialog } from "@/components/jobs/job-list-dialog";
import type { JobResource } from "@/components/jobs/job-resource";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { InfoDot } from "@/components/ui/composed/info-dot";
import {
	useRetryProcessingMutation,
	useRetryVectorizationMutation,
} from "@/hooks/mutations/use-job-mutations";
import { getProcessingStatusDescription } from "@/lib/presentation/processing-status";
import { cn } from "@/lib/utils";

type JobStatusPanelProps = {
	processingStatus: ProcessingStatus;
	jobQueue: JobQueue;
	resource: JobResource;
	/** For retry — required when resourceType is "asset" */
	assetId?: AssetId;
	/** For retry — required when resourceType is "block" */
	blockId?: BlockId;
	/** Optional filter for the job list dialog */
	assetIdFilter?: string;
	className?: string;
};

const JobStatusPanel = ({
	processingStatus,
	jobQueue,
	resource,
	assetId,
	blockId,
	assetIdFilter,
	className,
}: JobStatusPanelProps) => {
	const { mutate: retryProcessing } = useRetryProcessingMutation();
	const { mutate: retryVectorization } = useRetryVectorizationMutation();

	const showRetry = processingStatus === "failed";

	const handleRetry = () => {
		if (resource.resourceType === "asset" && assetId) {
			retryProcessing({
				assetId,
			});
		} else if (resource.resourceType === "block" && blockId && assetId) {
			retryVectorization({
				blockId,
				assetId,
			});
		}
	};

	return (
		<Card className={cn(className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-1">
					Preparation Status
					<InfoDot
						content="The content is prepared in background jobs after upload so it is
							ready"
					/>
				</CardTitle>
				<CardDescription>
					{getProcessingStatusDescription(processingStatus)}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex items-center gap-2">
				<JobStatusBadge status={processingStatus} className="h-8" />
				<JobListDialog
					jobQueue={jobQueue}
					resource={resource}
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
