import type { ProcessingStatus } from "@orcai/schema";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { getProcessingStatusLabel } from "@/lib/presentation/processing-status";
import { cn } from "@/lib/utils";

const statusConfig: Record<
	ProcessingStatus,
	{
		label: string;
		variant: "default" | "secondary" | "destructive" | "outline";
		showSpinner: boolean;
	}
> = {
	pending: {
		label: getProcessingStatusLabel("pending"),
		variant: "outline",
		showSpinner: false,
	},
	active: {
		label: getProcessingStatusLabel("active"),
		variant: "secondary",
		showSpinner: true,
	},
	completed: {
		label: getProcessingStatusLabel("completed"),
		variant: "default",
		showSpinner: false,
	},
	failed: {
		label: getProcessingStatusLabel("failed"),
		variant: "destructive",
		showSpinner: false,
	},
};

const JobStatusBadge = ({
	status,
	className,
}: {
	status: ProcessingStatus;
	className?: string;
}) => {
	const config = statusConfig[status];
	return (
		<Badge variant={config.variant} className={cn(className)}>
			{config.showSpinner && <Spinner className="mr-1 size-3" />}
			{config.label}
		</Badge>
	);
};

export { JobStatusBadge };
