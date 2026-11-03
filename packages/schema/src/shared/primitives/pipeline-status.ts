import { z } from "zod/v4";
import { isImageFileType } from "./file-type";

/** Where a background pipeline stands for one asset or one asset in a repository. */
export const PIPELINE_STATUSES = [
	"pending",
	"active",
	"completed",
	"failed",
] as const;

export const pipelineStatusSchema = z.enum(PIPELINE_STATUSES);

export type PipelineStatus = z.infer<typeof pipelineStatusSchema>;

/**
 * Why a pipeline failed. `model` is a provider error, `answer` an answer that
 * does not fit its schema, `output_limit` an answer cut off at its output
 * budget, `missing_extraction` a stored extraction that is gone. Only
 * `extraction`, `timeout`, `model`, `answer` and `other` retry on their own.
 */
export const PIPELINE_FAILURES = [
	"unsupported",
	"empty",
	"extraction",
	"timeout",
	"quota",
	"other",
	"model",
	"answer",
	"output_limit",
	"missing_extraction",
] as const;

export const pipelineFailureSchema = z.enum(PIPELINE_FAILURES);

export type PipelineFailure = z.infer<typeof pipelineFailureSchema>;

/** Whether a person retrying can help. */
export const isRetryableFailure = (failure: PipelineFailure) =>
	failure !== "unsupported" && failure !== "empty";

/** An image the utility model could not read, which an admin can fix by picking one that can. */
export const isUnreadableImage = (failure: PipelineFailure, fileType: string) =>
	failure === "unsupported" && isImageFileType(fileType);

/** Whether preparing a file that failed this way again can help. */
export const canPrepareAgain = (failure: PipelineFailure, fileType: string) =>
	isRetryableFailure(failure) || isUnreadableImage(failure, fileType);

/**
 * Whether the job retries on its own. A used-up quota waits for its pool to
 * reset, the same budget is cut off again, and a missing extraction already
 * had its file prepared again.
 */
export const isTransientFailure = (failure: PipelineFailure) =>
	isRetryableFailure(failure) &&
	failure !== "quota" &&
	failure !== "output_limit" &&
	failure !== "missing_extraction";
