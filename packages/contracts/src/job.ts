import {
	createJobInputSchema,
	createJobResponseSchema,
	listJobsInputSchema,
	listJobsResponseSchema,
	retryProcessingInputSchema,
	retryProcessingResponseSchema,
	retryVectorizationInputSchema,
	retryVectorizationResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const jobContracts = {
	list: base
		.meta(
			openapi({
				method: "GET",
				path: "/jobs",
				summary: "List jobs",
				tags: [
					"Jobs",
				],
			}),
		)
		.input(listJobsInputSchema)
		.output(listJobsResponseSchema),
	create: base
		.meta(
			openapi({
				method: "POST",
				path: "/jobs/create",
				summary: "Create a database block vector store job",
				tags: [
					"Jobs",
				],
			}),
		)
		.input(createJobInputSchema)
		.output(createJobResponseSchema),
	retryProcessing: base
		.meta(
			openapi({
				method: "POST",
				path: "/jobs/retry-processing",
				summary: "Retry processing for an asset",
				tags: [
					"Jobs",
				],
			}),
		)
		.input(retryProcessingInputSchema)
		.output(retryProcessingResponseSchema),
	retryVectorization: base
		.meta(
			openapi({
				method: "POST",
				path: "/jobs/retry-vectorization",
				summary: "Retry vectorization for an asset within a block",
				tags: [
					"Jobs",
				],
			}),
		)
		.input(retryVectorizationInputSchema)
		.output(retryVectorizationResponseSchema),
};
