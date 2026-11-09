import { expect, onTestFinished, test } from "bun:test";
import {
	DATA_EXPORT_DEAD_LETTER_JOB_NAME,
	DATA_EXPORT_EXPIRE_JOB_NAME,
	DATA_EXPORT_JOB_NAME,
	type JobQueue,
	PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
	PROCESS_ASSET_JOB_NAME,
	processAssetPayloadSchema,
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
import { clockSteps, IsolatedPgBossLive } from "./isolated-pg-boss";

const clock = new TestClock();
const steps = clockSteps(clock);
const { runPromise: run } = integrationRuntime(
	IsolatedPgBossLive({
		clock,
	}),
);
const boss = () => run(PgBossService.useSync(({ boss }) => boss));

/** Moves pg-boss's time on in steps of `stepMs` until `condition` holds. */
const until = (
	condition: () => Promise<boolean>,
	what: string,
	stepMs = 120_000,
) => steps.until(condition, what, stepMs);

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
		runWorkers(steps.track(definitions)).pipe(
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
		"the job to fail",
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

test("a job whose payload the definition rejects fails without running the handler or retrying, and so does its dead letter", async () => {
	const pgBoss = await boss();
	const handled: string[] = [];
	errors.length = 0;
	const handler = (job: { id: string }) =>
		Effect.sync(() => {
			handled.push(job.id);
		});
	await work([
		defineWorker({
			queue: PROCESS_ASSET_JOB_NAME,
			payload: processAssetPayloadSchema,
			concurrency: 1,
			pollingIntervalSeconds: 60,
			handler,
		}),
		defineWorker({
			queue: PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
			payload: processAssetPayloadSchema,
			concurrency: 1,
			pollingIntervalSeconds: 60,
			handler,
		}),
	]);

	const marker = crypto.randomUUID();
	const id =
		(await pgBoss.send(PROCESS_ASSET_JOB_NAME, {
			marker,
		})) ?? "";
	const deadLetter = async () =>
		(
			await pgBoss.findJobs(PROCESS_ASSET_DEAD_LETTER_JOB_NAME, {
				data: {
					marker,
				},
			})
		)[0];
	await until(
		async () => (await deadLetter())?.state === "failed",
		"the dead letter to fail",
	);

	expect(handled).toEqual([]);
	expect(await pgBoss.getJobById(PROCESS_ASSET_JOB_NAME, id)).toMatchObject({
		state: "failed",
		retryCount: 0,
	});
	expect(await deadLetter()).toMatchObject({
		sourceId: id,
		retryCount: 0,
	});
	expect(errors).toEqual([
		"Job payload is malformed",
		"Job payload is malformed",
	]);
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
		"the job to retry",
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
