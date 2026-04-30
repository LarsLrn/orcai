import { base } from "@orcai/contracts";
import {
	assetIdSchema,
	jobHistoryEntrySchema,
	jobQueues,
	PROCESS_ASSET_JOB_NAME,
	statusResponseSchema,
	VECTORIZE_ASSET_JOB_NAME,
} from "@orcai/schema";
import z from "zod/v4";
import { baseBlockSelectSchema } from "@/lib/orpc/schemas/block";

const jobResourceIdentitySchema = z.discriminatedUnion("resourceType", [
	z.object({
		resourceType: z.literal("block"),
		resourceId: baseBlockSelectSchema.shape.id,
	}),
	z.object({
		resourceType: z.literal("asset"),
		resourceId: assetIdSchema,
	}),
]);

export const createJobsContract = base
	.route({
		method: "POST",
		path: "/jobs/create",
		summary: "Create a database block vector store job",
		tags: [
			"Jobs",
		],
	})
	.input(
		z.object({
			blockId: baseBlockSelectSchema.shape.id,
			jobRunner: z.enum([
				PROCESS_ASSET_JOB_NAME,
				VECTORIZE_ASSET_JOB_NAME,
			]),
		}),
	)
	.output(statusResponseSchema);

export const listJobsContract = base
	.route({
		method: "GET",
		path: "/jobs",
		summary: "List jobs",
		tags: [
			"Jobs",
		],
	})
	.input(
		jobResourceIdentitySchema.and(
			z.object({
				jobQueue: jobQueues,
			}),
		),
	)
	.output(
		z.object({
			data: z.array(jobHistoryEntrySchema),
			rowCount: z.number(),
		}),
	);

export const retryProcessingContract = base
	.route({
		method: "POST",
		path: "/jobs/retry-processing",
		summary: "Retry processing for an asset",
		tags: [
			"Jobs",
		],
	})
	.input(
		z.object({
			assetId: assetIdSchema,
		}),
	)
	.output(statusResponseSchema);

export const retryVectorizationContract = base
	.route({
		method: "POST",
		path: "/jobs/retry-vectorization",
		summary: "Retry vectorization for an asset within a block",
		tags: [
			"Jobs",
		],
	})
	.input(
		z.object({
			blockId: baseBlockSelectSchema.shape.id,
			assetId: assetIdSchema,
		}),
	)
	.output(statusResponseSchema);
