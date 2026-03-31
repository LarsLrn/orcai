import type { ProcessingStatus } from "@orcai/schema";

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
