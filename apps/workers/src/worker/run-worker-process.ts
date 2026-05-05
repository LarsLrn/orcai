import { logErrorCause } from "@orcai/observability";
import type { Job } from "@orcai/pg-boss";
import { PgBossService, PgBossWorkersError } from "@orcai/pg-boss";
import type { JobQueue } from "@orcai/schema";
import * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Schedule from "effect/Schedule";
import type { WorkerDefinition } from "@/worker/types";

const retryPolicy = Schedule.exponential("1 second").pipe(
	Schedule.both(Schedule.recurs(9)),
	Schedule.jittered,
);

const createQueue = (name: JobQueue) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;
		yield* Effect.logInfo(`Ensuring queue ${name} exists`);
		yield* Effect.tryPromise({
			try: () =>
				boss.createQueue(name, {
					retryLimit: 3,
					retryDelay: 60,
					expireInSeconds: 3600,
				}),
			catch: (cause) =>
				new PgBossWorkersError({
					queue: name,
					step: "create-queue",
					cause,
				}),
		}).pipe(Effect.retry(retryPolicy));
		yield* Effect.logInfo(`Queue ${name} ready`);
	});

const registerWorkers = <TContext>(
	definitions: readonly WorkerDefinition<TContext | PgBossService, unknown>[],
) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;
		const services = yield* Effect.context<TContext | PgBossService>();

		const runWorkerBatch =
			(
				queue: JobQueue,
				handler: (
					jobs: Job<unknown>[],
				) => Effect.Effect<void, unknown, TContext | PgBossService>,
			) =>
			(jobs: Job<unknown>[]) =>
				Effect.runPromiseWith(services)(
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
				);

		yield* Effect.forEach(
			definitions,
			(definition) =>
				Effect.gen(function* () {
					yield* Effect.logInfo(`Registering worker ${definition.name}`);
					yield* Effect.tryPromise({
						try: () =>
							boss.work<unknown>(
								definition.name,
								definition.workOptions,
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

	const workerProgram = Effect.gen(function* () {
		yield* Effect.logInfo(`Starting ${params.name}...`);
		yield* Effect.logInfo(
			`Preparing ${params.definitions.length} worker definition(s)`,
		);

		yield* Effect.forEach(
			params.definitions,
			(definition) => createQueue(definition.name),
			{
				discard: true,
				concurrency: "unbounded",
			},
		);

		yield* registerWorkers(params.definitions);
		yield* scheduleWorkers(params.definitions);

		yield* Effect.logInfo(`${params.name} started`);
		return yield* Effect.never;
	});

	try {
		await runtime.runPromise(workerProgram);
	} catch (error) {
		console.error(`[workers] failed to start ${params.name}`, error);
		await runtime.dispose();
		process.exit(1);
	}
};
