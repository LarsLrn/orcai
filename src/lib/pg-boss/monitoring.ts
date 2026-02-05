import * as Effect from "effect/Effect";
import { PgBossService } from "@/lib/effect/services/pg-boss";
import { PgBossError } from "@/lib/effect/utils/errors";
import type { JobQueue } from "./schema/job";

export const getJobStatus = (params: { queueName: JobQueue; jobId: string }) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;

		return yield* Effect.tryPromise({
			try: () =>
				boss.findJobs(params.queueName, {
					id: params.jobId,
				}),
			catch: (error) =>
				new PgBossError({
					operation: "query",
					jobId: params.jobId,
					queue: params.queueName,
					cause: error,
				}),
		});
	});

export const getQueueInfo = (params: { queueName: JobQueue }) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;

		return yield* Effect.tryPromise({
			try: () => boss.getQueue(params.queueName),
			catch: (error) =>
				new PgBossError({
					operation: "query",
					queue: params.queueName,
					cause: error,
				}),
		});
	});

export const cancelJob = (params: { queueName: JobQueue; jobId: string }) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;

		return yield* Effect.tryPromise({
			try: () => boss.cancel(params.queueName, params.jobId),
			catch: (error) =>
				new PgBossError({
					operation: "cancel",
					jobId: params.jobId,
					queue: params.queueName,
					cause: error,
				}),
		});
	});

export const resumeJob = (params: { queueName: JobQueue; jobId: string }) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;

		return yield* Effect.tryPromise({
			try: () => boss.resume(params.queueName, params.jobId),
			catch: (error) =>
				new PgBossError({
					operation: "resume",
					jobId: params.jobId,
					queue: params.queueName,
					cause: error,
				}),
		});
	});
