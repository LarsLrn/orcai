import { logErrorCause, withActiveSpan } from "@orcai/observability";
import type { JobWithMetadata } from "@orcai/pg-boss";
import { PgBossService, PgBossWorkersError } from "@orcai/pg-boss";
import type { JobQueue } from "@orcai/schema";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import type { WorkerDefinition } from "@/worker/types";

const retryPolicy = Schedule.max([
	Schedule.exponential("1 second"),
	Schedule.recurs(9),
]).pipe(Schedule.jittered);

/** Creates the queue, or brings an existing one to these options. */
export const ensureQueue = (
	name: JobQueue,
	options: {
		readonly deadLetter?: JobQueue;
	} = {},
) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;
		const queueOptions = {
			retryLimit: 3,
			retryDelay: 60,
			expireInSeconds: 3600,
		};
		yield* Effect.logInfo(`Ensuring queue ${name} exists`);
		yield* Effect.tryPromise({
			try: async () => {
				await boss.createQueue(name, queueOptions);
				await boss.updateQueue(name, {
					...queueOptions,
					deadLetter: options.deadLetter ?? null,
				});
			},
			catch: (cause) =>
				new PgBossWorkersError({
					queue: name,
					step: "create-queue",
					cause,
				}),
		}).pipe(Effect.retry(retryPolicy));
		yield* Effect.logInfo(`Queue ${name} ready`);
	});

/** Replaces every worker's polling interval, for test stacks that cannot wait. */
const pollingIntervalOverride = Config.option(
	Config.number("WORKER_POLLING_INTERVAL_SECONDS"),
);

const registerWorkers = <TContext>(
	definitions: readonly WorkerDefinition<TContext | PgBossService, unknown>[],
) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;
		const services = yield* Effect.context<TContext | PgBossService>();
		const pollingIntervalSeconds = Option.getOrUndefined(
			yield* pollingIntervalOverride,
		);

		const runWorkerBatch =
			(
				queue: JobQueue,
				handler: (
					jobs: JobWithMetadata<unknown>[],
				) => Effect.Effect<void, unknown, TContext | PgBossService>,
			) =>
			(jobs: JobWithMetadata<unknown>[]) =>
				Effect.runPromiseWith(services)(
					// Joins the span this callback is called in.
					withActiveSpan(
						handler(jobs).pipe(
							Effect.tapCause((cause) =>
								logErrorCause("Worker batch failed", cause).pipe(
									Effect.annotateLogs({
										queue,
										jobIds: jobs.map((job) => job.id),
										jobCount: jobs.length,
									}),
								),
							),
						),
					),
					// pg-boss aborts a batch that outlives its expiry.
					{
						signal: jobs[0]?.signal,
					},
				);

		yield* Effect.forEach(
			definitions,
			(definition) =>
				Effect.gen(function* () {
					yield* Effect.logInfo(`Registering worker ${definition.name}`);
					yield* Effect.tryPromise({
						try: () =>
							boss.work(
								definition.name,
								{
									...definition.workOptions,
									pollingIntervalSeconds:
										pollingIntervalSeconds ??
										definition.workOptions.pollingIntervalSeconds,
									includeMetadata: true,
								},
								runWorkerBatch(definition.name, definition.handler),
							),
						catch: (cause) =>
							new PgBossWorkersError({
								queue: definition.name,
								step: "register-worker",
								cause,
							}),
					}).pipe(Effect.retry(retryPolicy));
					yield* Effect.logInfo(`Worker ${definition.name} registered`);
				}),
			{
				discard: true,
			},
		);
	});

const scheduleWorkers = <TContext>(
	definitions: readonly WorkerDefinition<TContext | PgBossService, unknown>[],
) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;

		yield* Effect.forEach(
			definitions,
			(definition) => {
				const schedule = definition.schedule;
				return schedule
					? Effect.gen(function* () {
							yield* Effect.logInfo(
								`Installing schedule ${schedule} for ${definition.name}`,
							);
							yield* Effect.tryPromise({
								try: () => boss.schedule(definition.name, schedule, {}),
								catch: (cause) =>
									new PgBossWorkersError({
										queue: definition.name,
										step: "schedule-worker",
										cause,
									}),
							}).pipe(Effect.retry(retryPolicy));
							yield* Effect.logInfo(
								`Schedule ${schedule} installed for ${definition.name}`,
							);
						})
					: Effect.logInfo(`No schedule configured for ${definition.name}`);
			},
			{
				discard: true,
			},
		);
	});

export const runWorkerProcess = async <TContext, TError>(params: {
	name: string;
	layer: Layer.Layer<TContext | PgBossService, TError, never>;
	definitions: readonly WorkerDefinition<TContext | PgBossService, unknown>[];
	/** Queues another process works; created here with the others. */
	queues?: readonly {
		readonly name: JobQueue;
		readonly deadLetter?: JobQueue;
	}[];
	/** Runs once at boot; a failure is logged and does not stop the workers. */
	setup?: Effect.Effect<void, unknown, TContext | PgBossService>;
}) => {
	const runtime = ManagedRuntime.make(params.layer);

	const shutdown = async (signal: NodeJS.Signals) => {
		console.log(`[workers] received ${signal}, shutting down ${params.name}`);
		await runtime.dispose();
		process.exit(0);
	};

	process.on("SIGINT", () => {
		void shutdown("SIGINT");
	});

	process.on("SIGTERM", () => {
		void shutdown("SIGTERM");
	});

	const startWorkers = Effect.gen(function* () {
		yield* Effect.logInfo(`Starting ${params.name}...`);
		yield* Effect.logInfo(
			`Preparing ${params.definitions.length} worker definition(s)`,
		);

		// A dead letter queue has to exist before the queue that names it.
		const queues = [
			...params.definitions,
			...(params.queues ?? []),
		];
		const ensureQueues = (selected: typeof queues) =>
			Effect.forEach(
				selected,
				(queue) =>
					ensureQueue(queue.name, {
						deadLetter: queue.deadLetter,
					}),
				{
					discard: true,
					concurrency: "unbounded",
				},
			);
		yield* ensureQueues(queues.filter((queue) => !queue.deadLetter));
		yield* ensureQueues(queues.filter((queue) => queue.deadLetter));

		yield* registerWorkers(params.definitions);
		yield* scheduleWorkers(params.definitions);

		if (params.setup) {
			yield* params.setup.pipe(
				Effect.retry(retryPolicy),
				Effect.catchCause((cause) =>
					logErrorCause(`${params.name} setup failed`, cause),
				),
			);
		}

		yield* Effect.logInfo(`${params.name} started`);
	}).pipe(Effect.withSpan("workers.startup"));

	const workerProgram = startWorkers.pipe(Effect.andThen(Effect.never));

	try {
		await runtime.runPromise(workerProgram);
	} catch (error) {
		console.error(`[workers] failed to start ${params.name}`, error);
		await runtime.dispose();
		process.exit(1);
	}
};
