import type { JobQueue } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { PgBossError } from "./errors";
import { PgBossService } from "./service";

/**
 * Send multiple jobs in batch.
 */
export const sendJobBatch = <T extends object = object>(params: {
	jobName: JobQueue;
	jobs: Array<{
		data: T;
		options?: {
			priority?: number;
			retryLimit?: number;
			retryDelay?: number;
		};
	}>;
}) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;

		yield* Effect.tryPromise({
			try: () =>
				boss.insert(
					params.jobName,
					params.jobs.map((job) => ({
						data: job.data,
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
