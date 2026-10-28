import { z } from "zod/v4";

/** Where a background pipeline stands for one asset or one asset in a repository. */
export const PIPELINE_STATUSES = [
	"pending",
	"active",
	"completed",
	"failed",
] as const;

export const pipelineStatusSchema = z.enum(PIPELINE_STATUSES);

export type PipelineStatus = z.infer<typeof pipelineStatusSchema>;

/** Why a pipeline failed. `unsupported`, `empty` and `quota` fail at once, since retrying right away cannot help. */
export const PIPELINE_FAILURES = [
	"unsupported",
	"empty",
	"extraction",
	"timeout",
	"quota",
	"other",
] as const;

export const pipelineFailureSchema = z.enum(PIPELINE_FAILURES);

export type PipelineFailure = z.infer<typeof pipelineFailureSchema>;

/** Whether a person retrying can help. */
export const isRetryableFailure = (failure: PipelineFailure) =>
	failure !== "unsupported" && failure !== "empty";

/** Whether the job retries on its own; a used-up quota waits for its pool to reset. */
export const isTransientFailure = (failure: PipelineFailure) =>
	isRetryableFailure(failure) && failure !== "quota";
