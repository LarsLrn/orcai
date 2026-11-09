import type { AssetState, PipelineStatus } from "@orcai/schema";
import { assetStateBadge } from "@/lib/labels/asset-state";
import type { BadgeItem } from "@/lib/labels/badge-item";
import { m } from "@/paraglide/messages";

const processingStatusDescriptions: Record<PipelineStatus, () => string> = {
	pending: m.processing_status_pending_description,
	active: m.processing_status_active_description,
	completed: m.processing_status_completed_description,
	failed: m.processing_status_failed_description,
};

export const getProcessingStatusDescription = (status: PipelineStatus) =>
	processingStatusDescriptions[status]();

const processingStatusStates: Record<PipelineStatus, AssetState> = {
	pending: "queued",
	active: "processing",
	completed: "ready",
	failed: "failed",
};

/** The status badge of an asset's processing: the same states as in a repository. */
export const processingStatusBadge = (status: PipelineStatus): BadgeItem =>
	assetStateBadge(processingStatusStates[status], true);
