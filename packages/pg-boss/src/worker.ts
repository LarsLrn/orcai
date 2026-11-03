import { logErrorCause, withActiveSpan } from "@orcai/observability";
import type { JobQueue } from "@orcai/schema";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FiberSet from "effect/FiberSet";
import * as Option from "effect/Option";
import type { JobResult, JobWithMetadata } from "pg-boss";
import { z } from "zod/v4";
import { PgBossWorkersError } from "./errors";
import { ensureQueues, QUEUES, startupRetry } from "./queues";
import { PgBossService } from "./service";

export interface WorkerDefinition<TPayload, R> {
	readonly queue: JobQueue;
	/** Jobs this process runs at once. */
	readonly concurrency: number;
	readonly pollingIntervalSeconds: number;
	/**
	 * What the handler reads from the job. A job it rejects fails without
	 * retries and goes to the dead letter queue, if the queue has one.
	 */
	readonly payload?: z.ZodType;
	/** A failure fails the job, which pg-boss retries as the queue table says. */
	readonly handler: (
		job: JobWithMetadata<TPayload>,
	) => Effect.Effect<void, unknown, R>;
}

export const defineWorker = <TPayload, R>(
	definition: WorkerDefinition<TPayload, R> & {
		readonly payload?: z.ZodType<TPayload>;
	},
): WorkerDefinition<TPayload, R> => definition;

/** Replaces every worker's polling interval, for test stacks that cannot wait. */
const pollingIntervalOverride = Config.option(
	Config.Number("WORKER_POLLING_INTERVAL_SECONDS"),
);

const register = <R>(
	definition: WorkerDefinition<never, R>,
	run: (
		effect: Effect.Effect<void, unknown, R>,
		options?: Effect.RunOptions,
	) => Promise<void>,
	pollingIntervalSeconds: number | undefined,
) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;
		const { queue, handler, payload } = definition;
		const annotations = (job: JobWithMetadata<never>) =>
			Effect.annotateLogs({
				queue,
				jobId: job.id,
				retryCount: job.retryCount,
			});
		const work = async (job: JobWithMetadata<never>): Promise<JobResult[]> => {
			const decoded = payload?.safeParse(job.data);
			if (decoded?.success === false) {
				const message = z.prettifyError(decoded.error);
				await run(
					Effect.logError("Job payload is malformed").pipe(
						annotations(job),
						Effect.annotateLogs({
							issues: message,
						}),
					),
				);
				return [
					{
						id: job.id,
						status: "deadletter",
						output: {
							message,
						},
					},
				];
			}
			await run(
				// Joins the `process <queue>` span pg-boss calls this in.
				withActiveSpan(
					handler(
						decoded
							? {
									...job,
									data: decoded.data as never,
								}
							: job,
					).pipe(
						Effect.tapCause((cause) =>
							Cause.hasInterruptsOnly(cause)
								? Effect.void
								: logErrorCause("Job failed", cause).pipe(annotations(job)),
						),
					),
				),
				// pg-boss aborts a job that outlives its expiry.
				{
					signal: job.signal,
				},
			);
			return [
				{
					id: job.id,
					status: "completed",
				},
			];
		};
		yield* Effect.tryPromise({
			try: () =>
				boss.work(
					queue,
					{
						batchSize: 1,
						localConcurrency: definition.concurrency,
						pollingIntervalSeconds:
							pollingIntervalSeconds ?? definition.pollingIntervalSeconds,
						includeMetadata: true,
						perJobResults: true,
					},
					([job]: JobWithMetadata<never>[]) => work(job),
				),
			catch: (cause) =>
				new PgBossWorkersError({
					queue,
					step: "register-worker",
					cause,
				}),
		}).pipe(Effect.retry(startupRetry));
	});

/** Installs the table's crons of the queues worked here, and drops crons the table no longer has. */
const schedule = (queues: readonly JobQueue[]) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;
		yield* Effect.forEach(
			queues,
			(queue) => {
				const cron = QUEUES[queue].schedule;
				return cron
					? Effect.tryPromise({
							try: () => boss.schedule(queue, cron, {}),
							catch: (cause) =>
								new PgBossWorkersError({
									queue,
									step: "schedule-worker",
									cause,
								}),
						}).pipe(Effect.retry(startupRetry))
					: Effect.void;
			},
			{
				discard: true,
			},
		);

		const installed = yield* Effect.tryPromise({
			try: () => boss.getSchedules(),
			catch: (cause) =>
				new PgBossWorkersError({
					queue: "*",
					step: "unschedule-worker",
					cause,
				}),
		});
		yield* Effect.forEach(
			installed.filter(
				(installed) =>
					QUEUES[installed.name as JobQueue]?.schedule !== installed.cron,
			),
			(stale) =>
				Effect.tryPromise({
					try: () => boss.unschedule(stale.name, stale.key),
					catch: (cause) =>
						new PgBossWorkersError({
							queue: stale.name,
							step: "unschedule-worker",
							cause,
						}),
				}).pipe(
					Effect.andThen(
						Effect.logInfo(`Removed schedule ${stale.cron} for ${stale.name}`),
					),
				),
			{
				discard: true,
			},
		);
	});

/**
 * Works the queues in this process until the scope closes, which stops
 * polling and interrupts running jobs for pg-boss to retry. Creates the
 * queues and installs their crons from the queue table first.
 */
export const runWorkers = <R>(
	definitions: readonly WorkerDefinition<never, R>[],
) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;
		const queues = definitions.map((definition) => definition.queue);
		const run = yield* FiberSet.makeRuntimePromise<R>();
		const pollingIntervalSeconds = Option.getOrUndefined(
			yield* pollingIntervalOverride,
		);

		yield* ensureQueues(queues);
		yield* Effect.addFinalizer(() =>
			Effect.forEach(
				queues,
				(queue) =>
					Effect.tryPromise(() =>
						boss.offWork(queue, {
							wait: false,
						}),
					).pipe(Effect.ignore),
				{
					discard: true,
				},
			),
		);
		yield* Effect.forEach(
			definitions,
			(definition) => register(definition, run, pollingIntervalSeconds),
			{
				discard: true,
			},
		);
		yield* schedule(queues);
		yield* Effect.logInfo(`Working ${queues.join(", ")}`);
	});
