import type { JobQueue } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { PgBossError } from "./errors";
import type { Job } from "./schema/job";
import { PgBossService } from "./service";

export const sendJobEffect = <T extends object = object>(params: {
	jobName: JobQueue;
	data: T & {
		resourceId?: string;
		resourceType?: string;
	};
	options: {
		resourceId: string;
		resourceType: "block" | "chat";
		priority?: number;
		retryLimit?: number;
		retryDelay?: number;
		expireInSeconds?: number;
	};
}) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;

		const jobData = {
			...params.data,
			resourceId: params.options.resourceId,
			resourceType: params.options.resourceType,
		};

		const jobId = yield* Effect.tryPromise({
			try: () =>
				boss.send(params.jobName, jobData, {
					priority: params.options.priority,
					retryLimit: params.options.retryLimit ?? 3,
					retryDelay: params.options.retryDelay ?? 60,
					expireInSeconds: params.options.expireInSeconds ?? 3600,
				}),
			catch: (error) =>
				new PgBossError({
					operation: "send",
					queue: params.jobName,
					cause: error,
				}),
		});

		if (!jobId) {
			return yield* new PgBossError({
				operation: "send",
				queue: params.jobName,
				cause: new Error("Failed to send job, no job ID returned"),
			});
		}

		return jobId;
	});

/**
 * Send multiple jobs in batch.
 */
export const sendJobBatchEffect = <T extends object = object>(params: {
	jobName: JobQueue;
	jobs: Array<{
		data: T & {
			resourceId?: string;
			resourceType?: string;
		};
		options?: {
			priority?: number;
			retryLimit?: number;
			retryDelay?: number;
		};
	}>;
	resourceOptions: {
		resourceId: string;
		resourceType: "block" | "chat" | "asset";
	};
}) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;

		yield* Effect.tryPromise({
			try: () =>
				boss.insert(
					params.jobName,
					params.jobs.map((job) => ({
						data: {
							...job.data,
							resourceId: params.resourceOptions.resourceId,
							resourceType: params.resourceOptions.resourceType,
						},
						priority: job.options?.priority,
						retryLimit: job.options?.retryLimit ?? 3,
						retryDelay: job.options?.retryDelay ?? 60,
					})),
					{},
				),
			catch: (error) =>
				new PgBossError({
					operation: "send",
					queue: params.jobName,
					cause: error,
				}),
		});
	});

/**
 * Get all pg-boss jobs for a specific resource.
 */
export const getJobsByResourceEffect = (params: {
	jobQueue: JobQueue;
	resourceId: string;
}) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;

		const data = yield* Effect.tryPromise({
			try: async () =>
				await boss.findJobs(params.jobQueue, {
					data: {
						resourceId: params.resourceId,
					},
				}),
			catch: (error) =>
				new PgBossError({
					operation: "query",
					queue: params.jobQueue,
					cause: error,
				}),
		});

		return data as Job[];
	});
