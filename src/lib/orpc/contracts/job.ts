import z from "zod/v4";
import { baseBlockSelectSchema } from "@/lib/orpc/schemas/block";
import { statusSchema } from "@/lib/orpc/schemas/shared";
import { jobSchema } from "@/lib/pg-boss/schema/job";
import {
	jobQueues,
	PROCESS_ASSET_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
} from "@/lib/pg-boss/schema/job-queues";
import { base } from "./base";

export const createJobsContract = base
	.route({
		method: "POST",
		path: "/jobs/create",
		summary: "Create a database block vector store job",
		tags: ["Jobs"],
	})
	.input(
		z.object({
			blockId: baseBlockSelectSchema.shape.id,
			jobRunner: z.enum([PROCESS_ASSET_JOB_NAME, VECTORIZE_ASSET_JOB_NAME]),
		}),
	)
	.output(statusSchema);

export const listJobsContract = base
	.route({
		method: "GET",
		path: "/jobs",
		summary: "List jobs",
		tags: ["Jobs"],
	})
	.input(
		z.object({
			jobQueue: jobQueues,
			resourceId: z.uuidv4(),
		}),
	)
	.output(z.object({ data: z.array(jobSchema), rowCount: z.number() }));
