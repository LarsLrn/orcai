import type { AssetId } from "@orcai/core";
import type { PipelineStatus } from "@orcai/schema";
import { RefreshCwIcon } from "lucide-react";
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
import { useReprocessAssetMutation } from "@/hooks/mutations/use-asset-mutations";
import { getProcessingStatusDescription } from "@/lib/presentation/processing-status";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type JobStatusPanelProps = {
	processingStatus: PipelineStatus;
	assetId: AssetId;
	className?: string;
};

const JobStatusPanel = ({
	processingStatus,
	assetId,
	className,
}: JobStatusPanelProps) => {
	const { mutate: reprocessAsset } = useReprocessAssetMutation();

	return (
		<Card className={cn(className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-1">
					{m.jobs_status_panel_title()}
					<InfoDot content={m.jobs_status_panel_info_description()} />
				</CardTitle>
				<CardDescription>
					{getProcessingStatusDescription(processingStatus)}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex items-center gap-2">
				<JobStatusBadge status={processingStatus} className="h-8" />
				{processingStatus === "failed" && (
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							reprocessAsset({
								id: assetId,
							})
						}
					>
						<RefreshCwIcon className="mr-1 h-3 w-3" />
						{m.jobs_status_panel_retry_button()}
					</Button>
				)}
			</CardContent>
		</Card>
	);
};

export { JobStatusPanel };
