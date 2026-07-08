import { z } from "zod/v4";
import { assetIdSchema } from "../asset/ref";
import { blockIdSchema } from "../block/ref";
import {
	jobQueues,
	PROCESS_ASSET_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
} from "./parts/job-queues";

export const jobResourceIdentitySchema = z.discriminatedUnion("resourceType", [
	z.object({
		resourceType: z.literal("block"),
		resourceId: blockIdSchema,
	}),
	z.object({
		resourceType: z.literal("asset"),
		resourceId: assetIdSchema,
	}),
]);

export const createJobInputSchema = z.object({
	blockId: blockIdSchema,
	jobRunner: z.enum([
		PROCESS_ASSET_JOB_NAME,
		VECTORIZE_ASSET_JOB_NAME,
	]),
});

export const listJobsInputSchema = jobResourceIdentitySchema.and(
	z.object({
		jobQueue: jobQueues,
	}),
);

export const retryProcessingInputSchema = z.object({
	assetId: assetIdSchema,
});

export const retryVectorizationInputSchema = z.object({
	blockId: blockIdSchema,
	assetId: assetIdSchema,
});

export type CreateJobInput = z.infer<typeof createJobInputSchema>;
export type JobResourceIdentity = z.infer<typeof jobResourceIdentitySchema>;
export type ListJobsInput = z.infer<typeof listJobsInputSchema>;
export type RetryProcessingInput = z.infer<typeof retryProcessingInputSchema>;
export type RetryVectorizationInput = z.infer<
	typeof retryVectorizationInputSchema
>;
