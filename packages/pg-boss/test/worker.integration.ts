import { expect, onTestFinished, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import {
	DATA_EXPORT_DEAD_LETTER_JOB_NAME,
	DATA_EXPORT_EXPIRE_JOB_NAME,
	DATA_EXPORT_JOB_NAME,
	type JobQueue,
} from "@orcai/schema";
import { integrationRuntime } from "@orcai/testing";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Logger from "effect/Logger";
import * as Scope from "effect/Scope";
import {
	defineWorker,
	ensureQueues,
	PgBossService,
	QUEUES,
	runWorkers,
	TestClock,
	type WorkerDefinition,
} from "../src";
import { IsolatedPgBossLive } from "./isolated-pg-boss";

const clock = new TestClock();
const { runPromise: run } = integrationRuntime(
	IsolatedPgBossLive({
		clock,
	}),
);
const boss = () => run(PgBossService.useSync(({ boss }) => boss));

/** Moves pg-boss's time on in steps of `stepMs` until `condition` holds. */
const until = async (condition: () => Promise<boolean>, stepMs = 120_000) => {
	const deadline = Date.now() + 20_000;
	while (!(await condition())) {
		if (Date.now() > deadline) throw new Error("Timed out");
		await clock.setTime(clock.now() + stepMs);
		await clock.tick(1);
		await sleep(10);
	}
};

const errors: string[] = [];
const collectErrors = Logger.layer([
	Logger.make(({ logLevel, message }) => {
		if (logLevel === "Error") errors.push(String(message));
	}),
]);

/** Works the queues with the definitions until the test ends; their logs land in `errors`. */
const work = async (definitions: readonly WorkerDefinition<never, never>[]) => {
	const scope = await run(Scope.make());
	onTestFinished(() => run(Scope.close(scope, Exit.void)));
	await run(
		runWorkers(definitions).pipe(
			Scope.provide(scope),
			Effect.provide(collectErrors),
		),
	);
	return scope;
};

test("ensureQueues brings an existing queue to the queue table", async () => {
	const pgBoss = await boss();
	await pgBoss.updateQueue(DATA_EXPORT_JOB_NAME, {
		retryLimit: 0,
		deadLetter: null,
	});

	await run(
		ensureQueues([
			DATA_EXPORT_JOB_NAME,
		]),
	);

	const { deadLetter, retryLimit, retryDelay, expireInSeconds } =
		QUEUES[DATA_EXPORT_JOB_NAME];
	expect(await pgBoss.getQueue(DATA_EXPORT_JOB_NAME)).toMatchObject({
		deadLetter,
		retryLimit,
		retryDelay,
		expireInSeconds,
	});
});

test("a failing job runs as often as the queue table says, logs each failure once, then moves to its dead letter queue", async () => {
	const pgBoss = await boss();
	const deliveries: string[] = [];
	errors.length = 0;
	await work([
		defineWorker({
			queue: DATA_EXPORT_JOB_NAME,
			concurrency: 1,
			pollingIntervalSeconds: 60,
			handler: (job) =>
				Effect.suspend(() => {
					deliveries.push(job.id);
					return Effect.fail(new Error("export failed"));
				}),
		}),
	]);

	const id = await pgBoss.send(DATA_EXPORT_JOB_NAME, {
		marker: crypto.randomUUID(),
	});
	await until(
		async () =>
			(await pgBoss.getJobById(DATA_EXPORT_JOB_NAME, id ?? ""))?.state ===
			"failed",
	);

	const runs = QUEUES[DATA_EXPORT_JOB_NAME].retryLimit + 1;
	expect(deliveries).toEqual(Array(runs).fill(id));
	expect(errors).toEqual(Array(runs).fill("Job failed"));
	const [deadLetter] = await pgBoss.findJobs(DATA_EXPORT_DEAD_LETTER_JOB_NAME, {
		queued: true,
	});
	const { retryLimit, retryDelay, retryBackoff, expireInSeconds } =
		QUEUES[DATA_EXPORT_DEAD_LETTER_JOB_NAME];
	expect(deadLetter).toMatchObject({
		sourceId: id ?? "",
		retryLimit,
		retryDelay,
		retryBackoff,
		expireInSeconds,
	});
});

test("closing the scope stops the workers and interrupts a running job, which pg-boss retries", async () => {
	const pgBoss = await boss();
	const started = Promise.withResolvers<void>();
	let interrupted = false;
	errors.length = 0;
	const scope = await work([
		defineWorker({
			queue: DATA_EXPORT_JOB_NAME,
			concurrency: 1,
			pollingIntervalSeconds: 60,
			handler: () =>
				Effect.sync(() => started.resolve()).pipe(
					Effect.andThen(Effect.never),
					Effect.onInterrupt(() =>
						Effect.sync(() => {
							interrupted = true;
						}),
					),
				),
		}),
	]);
	const id = await pgBoss.send(DATA_EXPORT_JOB_NAME, {
		marker: crypto.randomUUID(),
	});
	await clock.setTime(clock.now() + 60_000);
	await clock.tick(1);
	await started.promise;

	await run(Scope.close(scope, Exit.void));

	expect(interrupted).toBe(true);
	await until(
		async () =>
			(await pgBoss.getJobById(DATA_EXPORT_JOB_NAME, id ?? ""))?.state ===
			"retry",
		1,
	);
	expect(errors).toEqual([]);
});

test("a worked queue gets its cron from the queue table, and a cron the table does not have goes", async () => {
	const pgBoss = await boss();
	const retired = "retired-cron-job";
	await pgBoss.createQueue(retired);
	await pgBoss.schedule(retired, "* * * * *");

	await work([
		defineWorker({
			queue: DATA_EXPORT_EXPIRE_JOB_NAME,
			concurrency: 1,
			pollingIntervalSeconds: 60,
			handler: () => Effect.void,
		}),
	]);

	const schedules = await pgBoss.getSchedules();
	expect(
		schedules.map(({ name, cron }) => ({
			name: name as JobQueue,
			cron,
		})),
	).toEqual([
		{
			name: DATA_EXPORT_EXPIRE_JOB_NAME,
			cron: QUEUES[DATA_EXPORT_EXPIRE_JOB_NAME].schedule ?? "",
		},
	]);
});
