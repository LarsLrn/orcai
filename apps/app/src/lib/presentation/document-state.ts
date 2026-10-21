import type { DocumentState, PipelineFailure } from "@orcai/schema";
import { LoaderCircleIcon } from "lucide-react";
import type { ResourceCardBadgeItem } from "@/components/ui/shell/resource-card";
import { m } from "@/paraglide/messages";

const documentStateLabels: Record<DocumentState, () => string> = {
	queued: m.document_state_queued_label,
	processing: m.document_state_processing_label,
	indexing: m.document_state_indexing_label,
	ready: m.document_state_ready_label,
	failed: m.document_state_failed_label,
};

const documentStateVariants: Record<
	DocumentState,
	ResourceCardBadgeItem["variant"]
> = {
	queued: "info",
	processing: "processing",
	indexing: "processing",
	ready: "success",
	failed: "danger",
};

/** The status badge of a document in a repository. */
export const documentStateBadge = (
	state: DocumentState,
): ResourceCardBadgeItem => {
	const working = state === "processing" || state === "indexing";
	return {
		label: documentStateLabels[state](),
		variant: documentStateVariants[state],
		icon: working ? LoaderCircleIcon : undefined,
		className: working ? "[&>svg]:animate-spin" : undefined,
	};
};

const failureDescriptions: Record<PipelineFailure, () => string> = {
	unsupported: m.pipeline_failure_unsupported,
	empty: m.pipeline_failure_empty,
	extraction: m.pipeline_failure_extraction,
	timeout: m.pipeline_failure_timeout,
	other: m.pipeline_failure_other,
};

/** Why preparing failed, in words; says so when retrying cannot help. */
export const getPipelineFailureDescription = (failure: PipelineFailure) =>
	failureDescriptions[failure]();
