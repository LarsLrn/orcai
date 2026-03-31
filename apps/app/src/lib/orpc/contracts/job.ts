import { jobSchema } from "@orcai/pg-boss";
import {
	jobQueues,
	PROCESS_ASSET_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
} from "@orcai/schema";
import z from "zod/v4";
import { assetSelectSchema } from "@/lib/orpc/schemas/asset";
import { baseBlockSelectSchema } from "@/lib/orpc/schemas/block";
import { statusSchema } from "@/lib/orpc/schemas/shared";
import { base } from "./base";

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
	.output(statusSchema);

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
		z.object({
			jobQueue: jobQueues,
			resourceId: z.uuidv4(),
			resourceType: z.enum([
				"block",
				"asset",
			]),
		}),
	)
	.output(
		z.object({
			data: z.array(jobSchema),
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
			assetId: assetSelectSchema.shape.id,
		}),
	)
	.output(statusSchema);

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
			assetId: assetSelectSchema.shape.id,
		}),
	)
	.output(statusSchema);
