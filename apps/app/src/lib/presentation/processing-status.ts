import type { ProcessingStatus } from "@orcai/schema";
import type { Badge } from "@/components/ui/badge";

const PROCESSING_STATUS_LABELS: Record<ProcessingStatus, string> = {
	pending: "Queued",
	active: "Processing",
	completed: "Ready",
	failed: "Needs attention",
};

const PROCESSING_STATUS_DESCRIPTIONS: Record<ProcessingStatus, string> = {
	pending: "Waiting to be prepared for search and citations.",
	active: "Currently being prepared for search and citations.",
	completed: "Ready to be used in search, retrieval, and citations.",
	failed: "Preparation failed. Review the job log or retry processing.",
};

export const getProcessingStatusLabel = (status: ProcessingStatus) =>
	PROCESSING_STATUS_LABELS[status];

export const getProcessingStatusDescription = (status: ProcessingStatus) =>
	PROCESSING_STATUS_DESCRIPTIONS[status];

/** Status colour family for a processing state, per the Tint Not Fill Rule. */
const PROCESSING_STATUS_VARIANTS: Record<
	ProcessingStatus,
	React.ComponentProps<typeof Badge>["variant"]
> = {
	pending: "info",
	active: "processing",
	completed: "success",
	failed: "danger",
};

export const getProcessingStatusVariant = (status: ProcessingStatus) =>
	PROCESSING_STATUS_VARIANTS[status];
