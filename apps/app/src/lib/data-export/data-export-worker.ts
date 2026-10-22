import type { DB } from "@orcai/db";
import { logErrorCause, withActiveSpan } from "@orcai/observability";
import { type Job, PgBossService } from "@orcai/pg-boss";
import type { S3Service } from "@orcai/s3/server";
import {
	DATA_EXPORT_DEAD_LETTER_JOB_NAME,
	DATA_EXPORT_JOB_NAME,
	dataExportPayloadSchema,
	type JobQueue,
} from "@orcai/schema";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FiberSet from "effect/FiberSet";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import { transcriptMarkdown } from "@/lib/ai/turn-view/message-markdown";
import type { AppConfigService } from "@/lib/effect/services/config";
import { failDataExports, runDataExport } from "./data-export";

type WorkerServices = DB | S3Service | PgBossService | AppConfigService;

const QUEUES = [
	DATA_EXPORT_JOB_NAME,
	DATA_EXPORT_DEAD_LETTER_JOB_NAME,
] as const;

/** Replaces the polling interval, for test stacks that cannot wait. */
const pollingIntervalOverride = Config.option(
	Config.number("WORKER_POLLING_INTERVAL_SECONDS"),
);

const dataExportIdsOf = (jobs: Job<unknown>[]) =>
	Effect.try(() =>
		jobs.map((job) => dataExportPayloadSchema.parse(job.data).dataExportId),
	);

/**
 * Works the data export queues in the app server, which holds the transcript
 * formatting. It starts once the background workers have created the queues,
 * so a stack without them exports nothing, and runs one export at a time.
 * Shutting down interrupts a running export; pg-boss retries it later.
 */
export const DataExportWorkerLive = Layer.effectDiscard(
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;
		const run = yield* FiberSet.makeRuntimePromise<WorkerServices>();
		const pollingIntervalSeconds = Option.getOrElse(
			yield* pollingIntervalOverride,
			() => 2,
		);

		const handler =
			<A, E>(
				queue: JobQueue,
				process: (jobs: Job<unknown>[]) => Effect.Effect<A, E, WorkerServices>,
			) =>
			(jobs: Job<unknown>[]) =>
				run(
					// Joins the span pg-boss calls this in.
					withActiveSpan(
						process(jobs).pipe(
							Effect.tapCause((cause) =>
								logErrorCause("Worker batch failed", cause).pipe(
									Effect.annotateLogs({
										queue,
										jobIds: jobs.map((job) => job.id),
									}),
								),
							),
						),
					),
					{
						signal: jobs[0]?.signal,
					},
				);

		const queuesExist = Effect.tryPromise(() =>
			Promise.all(QUEUES.map((name) => boss.getQueue(name))),
		).pipe(
			Effect.map((queues) => queues.every((queue) => queue !== null)),
			Effect.orElseSucceed(() => false),
		);

		// Registration runs once the queues exist, so a failure is transient.
		const registration = Schedule.spaced("5 seconds");

		const start = Effect.gen(function* () {
			yield* queuesExist.pipe(
				Effect.repeat({
					until: (exist) => exist,
					schedule: Schedule.spaced("5 seconds"),
				}),
			);
			yield* Effect.tryPromise(() =>
				boss.work(
					DATA_EXPORT_JOB_NAME,
					{
						batchSize: 1,
						localConcurrency: 1,
						pollingIntervalSeconds,
					},
					handler(DATA_EXPORT_JOB_NAME, (jobs) =>
						dataExportIdsOf(jobs).pipe(
							Effect.flatMap((ids) =>
								Effect.forEach(
									ids,
									(id) => runDataExport(id, transcriptMarkdown),
									{
										discard: true,
									},
								),
							),
						),
					),
				),
			).pipe(Effect.retry(registration));
			yield* Effect.tryPromise(() =>
				boss.work(
					DATA_EXPORT_DEAD_LETTER_JOB_NAME,
					{
						batchSize: 10,
						localConcurrency: 1,
						pollingIntervalSeconds,
					},
					handler(DATA_EXPORT_DEAD_LETTER_JOB_NAME, (jobs) =>
						dataExportIdsOf(jobs).pipe(Effect.flatMap(failDataExports)),
					),
				),
			).pipe(Effect.retry(registration));
			yield* Effect.logInfo("Data export worker started");
		}).pipe(
			Effect.catchCause((cause) =>
				logErrorCause("Data export worker failed to start", cause),
			),
		);

		yield* Effect.addFinalizer(() =>
			Effect.tryPromise(() =>
				Promise.all(
					QUEUES.map((name) =>
						boss.offWork(name, {
							wait: false,
						}),
					),
				),
			).pipe(Effect.ignore),
		);
		yield* Effect.forkScoped(start);
	}),
);
