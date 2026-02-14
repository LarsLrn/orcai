import { z } from "zod/v4";

export const PROCESS_ASSET_JOB_NAME = "process-asset-job";
export const VECTORIZE_ASSET_JOB_NAME = "vectorize-asset-job";

export const jobQueues = z.enum([
	PROCESS_ASSET_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
]);

export type JobQueue = z.infer<typeof jobQueues>;
