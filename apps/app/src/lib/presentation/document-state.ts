import {
	type DocumentState,
	type FileType,
	isImageFileType,
	isRetryableFailure,
	type PipelineFailure,
} from "@orcai/schema";
import { LoaderCircleIcon } from "lucide-react";
import type { BadgeItem } from "@/lib/presentation/badge-item";
import { m } from "@/paraglide/messages";

const documentStateLabels: Record<DocumentState, () => string> = {
	queued: m.document_state_queued_label,
	processing: m.document_state_processing_label,
	indexing: m.document_state_indexing_label,
	ready: m.document_state_ready_label,
	failed: m.document_state_failed_label,
};

const documentStateVariants: Record<DocumentState, BadgeItem["variant"]> = {
	queued: "info",
	processing: "processing",
	indexing: "processing",
	ready: "success",
	failed: "danger",
};

/** The status badge of a document in a repository. */
export const documentStateBadge = (state: DocumentState): BadgeItem => {
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
	quota: m.pipeline_failure_quota,
	other: m.pipeline_failure_other,
};

/** An image the utility model could not read can be processed again once an admin picks one that can. */
const unreadableImage = (failure: PipelineFailure, fileType: FileType) =>
	failure === "unsupported" && isImageFileType(fileType);

/** Whether processing a failed file again can help. */
export const canReprocess = (failure: PipelineFailure, fileType: FileType) =>
	isRetryableFailure(failure) || unreadableImage(failure, fileType);

/** Why preparing a file failed, in words; says so when retrying cannot help. */
export const getPipelineFailureDescription = (
	failure: PipelineFailure,
	fileType: FileType,
) =>
	unreadableImage(failure, fileType)
		? m.pipeline_failure_unsupported_image()
		: failureDescriptions[failure]();
