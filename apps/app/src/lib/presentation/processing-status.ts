import type { PipelineStatus } from "@orcai/schema";
import { LoaderCircleIcon } from "lucide-react";
import type { Badge } from "@/components/ui/badge";
import type { BadgeItem } from "@/lib/presentation/badge-item";
import { m } from "@/paraglide/messages";

const processingStatusLabels: Record<PipelineStatus, () => string> = {
	pending: m.processing_status_pending_label,
	active: m.processing_status_active_label,
	completed: m.processing_status_completed_label,
	failed: m.processing_status_failed_label,
};

const processingStatusDescriptions: Record<PipelineStatus, () => string> = {
	pending: m.processing_status_pending_description,
	active: m.processing_status_active_description,
	completed: m.processing_status_completed_description,
	failed: m.processing_status_failed_description,
};

export const getProcessingStatusLabel = (status: PipelineStatus) =>
	processingStatusLabels[status]();

export const getProcessingStatusDescription = (status: PipelineStatus) =>
	processingStatusDescriptions[status]();

/** Status colour family for a processing state, per the Tint Not Fill Rule. */
const PROCESSING_STATUS_VARIANTS: Record<
	PipelineStatus,
	React.ComponentProps<typeof Badge>["variant"]
> = {
	pending: "info",
	active: "processing",
	completed: "success",
	failed: "danger",
};

export const getProcessingStatusVariant = (status: PipelineStatus) =>
	PROCESSING_STATUS_VARIANTS[status];

/** The status badge of an asset's processing. */
export const processingStatusBadge = (status: PipelineStatus): BadgeItem => ({
	label: getProcessingStatusLabel(status),
	variant: getProcessingStatusVariant(status),
	icon: status === "active" ? LoaderCircleIcon : undefined,
	className: status === "active" ? "[&>svg]:animate-spin" : undefined,
});
