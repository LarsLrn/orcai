import { beforeAll, describe, expect, onTestFinished, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import type { DataExportId } from "@orcai/core";
import {
	defineWorker,
	liveJobs,
	type PgBoss,
	PgBossService,
	runWorkers,
	TestClock,
} from "@orcai/pg-boss";
import {
	DATA_EXPORT_DEAD_LETTER_JOB_NAME,
	DATA_EXPORT_JOB_NAME,
	DATA_EXPORT_SWEEP_JOB_NAME,
	type DataExportPayload,
} from "@orcai/schema";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import { transcriptMarkdown } from "@/lib/ai/turn-view/message-markdown";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	type Actor,
	appIntegration,
	TIMEOUT,
} from "@/lib/testing/app-integration";
import {
	failDataExports,
	runDataExport,
	strandedDataExports,
} from "./data-export";
import { DataExportWorkerLive } from "./data-export-worker";

const clock = new TestClock();

const { run, organizationWith, procedureOptions } = appIntegration({
	clock,
});

const procedures = await run(Procedures);

let boss: PgBoss;
beforeAll(async () => {
	boss = await run(PgBossService.useSync(({ boss }) => boss));
});

const owner = async () => {
	const {
		actors: [actor],
	} = await organizationWith([
		"member",
	]);
	return actor;
};

const requestExport = async (actor: Actor) =>
	(await run(procedures.dataExport.request({}, await procedureOptions(actor))))
		.data;

const latestStatus = async (actor: Actor) =>
	(await run(procedures.dataExport.latest({}, await procedureOptions(actor))))
		.data?.status;

const runningRuns = async (actor: Actor) =>
	(await run(procedures.activity.summary({}, await procedureOptions(actor))))
		.running.length;

/** Whether an export or dead letter job for the export still waits, retries or runs. */
const hasLiveJob = async (dataExportId: DataExportId) =>
	(
		await run(
			liveJobs<DataExportPayload>([
				DATA_EXPORT_JOB_NAME,
				DATA_EXPORT_DEAD_LETTER_JOB_NAME,
			]),
		)
	).some((job) => job.data.dataExportId === dataExportId);

/**
 * Moves pg-boss's time on in steps of `stepMs` until no job for the export is
 * live. A step shorter than the queues' expiry never expires a running job.
 */
const exhaust = async (dataExportId: DataExportId, stepMs: number) => {
	const deadline = Date.now() + 25_000;
	while (await hasLiveJob(dataExportId)) {
		if (Date.now() > deadline) throw new Error("The jobs never ran out");
		await clock.setTime(clock.now() + stepMs);
		await clock.tick(1);
		await sleep(10);
	}
};

/** Works exports with `attempt` and their dead letter queue with `exhausted` until the test ends. */
const work = async (
	attempt: Effect.Effect<void, unknown>,
	exhausted: Effect.Effect<void, unknown>,
) => {
	const scope = await run(Scope.make());
	onTestFinished(() => run(Scope.close(scope, Exit.void)));
	await run(
		runWorkers([
			defineWorker({
				queue: DATA_EXPORT_JOB_NAME,
				concurrency: 1,
				pollingIntervalSeconds: 60,
				handler: () => attempt,
			}),
			defineWorker({
				queue: DATA_EXPORT_DEAD_LETTER_JOB_NAME,
				concurrency: 1,
				pollingIntervalSeconds: 60,
				handler: () => exhausted,
			}),
		]).pipe(Scope.provide(scope)),
	);
};

/**
 * The test's own stranded exports, read batch by batch as the sweep reads
 * them: other files' exports keep their jobs in schemas of their own, so they
 * look stranded from here.
 */
const strandedOf = (ids: readonly DataExportId[], limit?: number) =>
	run(
		Effect.gen(function* () {
			const found: DataExportId[] = [];
			let after: DataExportId | undefined;
			do {
				const batch: Effect.Success<ReturnType<typeof strandedDataExports>> =
					yield* strandedDataExports(after, limit);
				found.push(...batch.stranded.filter((id) => ids.includes(id)));
				after = batch.next;
			} while (after);
			return found;
		}),
	);

/** The sweep over the test's own exports. */
const sweep = async (...ids: DataExportId[]) =>
	run(failDataExports(await strandedOf(ids)));

/** Takes the export's job off its queue, as retention does with a finished job. */
const dropJob = async (dataExportId: DataExportId) => {
	const jobs = await boss.findJobs(DATA_EXPORT_JOB_NAME, {
		data: {
			dataExportId,
		},
	});
	expect(jobs).toHaveLength(1);
	await boss.deleteJob(
		DATA_EXPORT_JOB_NAME,
		jobs.map((job) => job.id),
	);
};

const unreachable = new Error("connect ECONNREFUSED 127.0.0.1:5432");

describe("an export whose dead letter handler gave up", () => {
	test.each([
		{
			case: "a handler exception",
			attempt: Effect.fail(new Error("archive failed")),
			exhausted: Effect.die(new Error("dead letter handler bug")),
			stepMs: 120_000,
		},
		{
			case: "the database unavailable through exhaustion",
			attempt: Effect.fail(unreachable),
			exhausted: Effect.fail(unreachable),
			stepMs: 120_000,
		},
		{
			case: "workers that hang until their jobs expire",
			attempt: Effect.never,
			exhausted: Effect.never,
			stepMs: 3_700_000,
		},
	])(
		"after $case fails, settles its run and lets the user export again",
		async ({ attempt, exhausted, stepMs }) => {
			const actor = await owner();
			await work(attempt, exhausted);
			const requested = await requestExport(actor);
			await exhaust(requested.id, stepMs);
			expect(await latestStatus(actor)).toBe("pending");
			expect(await runningRuns(actor)).toBe(1);

			await sweep(requested.id);
			expect(await latestStatus(actor)).toBe("failed");
			expect(await runningRuns(actor)).toBe(0);
			expect((await requestExport(actor)).status).toBe("pending");
		},
		TIMEOUT,
	);
});

describe("the export sweep", () => {
	test(
		"leaves an export whose job still waits",
		async () => {
			const actor = await owner();
			const requested = await requestExport(actor);

			expect(
				await strandedOf([
					requested.id,
				]),
			).toEqual([]);
			await sweep(requested.id);
			expect(await latestStatus(actor)).toBe("pending");
		},
		TIMEOUT,
	);

	test(
		"fails an export whose job retention removed, once",
		async () => {
			const actor = await owner();
			const requested = await requestExport(actor);
			await dropJob(requested.id);

			expect(
				await run(
					failDataExports(
						await strandedOf([
							requested.id,
						]),
					),
				),
			).toBe(1);
			expect(await latestStatus(actor)).toBe("failed");
			expect(
				await run(
					failDataExports(
						await strandedOf([
							requested.id,
						]),
					),
				),
			).toBe(0);
		},
		TIMEOUT,
	);

	test(
		"leaves an export that finished after the sweep read it",
		async () => {
			const actor = await owner();
			const requested = await requestExport(actor);
			await dropJob(requested.id);
			const stranded = await strandedOf([
				requested.id,
			]);
			expect(stranded).toEqual([
				requested.id,
			]);

			await run(runDataExport(requested.id, transcriptMarkdown));
			await run(failDataExports(stranded));
			expect(await latestStatus(actor)).toBe("ready");
		},
		TIMEOUT,
	);

	test(
		"reads the exports in flight batch by batch",
		async () => {
			const first = await requestExport(await owner());
			await dropJob(first.id);
			const second = await requestExport(await owner());
			await dropJob(second.id);

			expect(
				(
					await strandedOf(
						[
							first.id,
							second.id,
						],
						1,
					)
				).sort(),
			).toEqual(
				[
					first.id,
					second.id,
				].sort(),
			);
		},
		TIMEOUT,
	);
});

describe("the data export workers", () => {
	test(
		"start the sweep while the export workers cannot start",
		async () => {
			const schema = await run(PgBossService.useSync(({ schema }) => schema));
			const worked: string[] = [];
			const failing = new Proxy(boss, {
				get: (target, property) => {
					if (property === "work")
						return (name: string, ...rest: unknown[]) => {
							if (name === DATA_EXPORT_JOB_NAME)
								return Promise.reject(new Error("queue unavailable"));
							worked.push(name);
							return (target.work as (...args: unknown[]) => unknown)(
								name,
								...rest,
							);
						};
					const value = Reflect.get(target, property);
					return typeof value === "function" ? value.bind(target) : value;
				},
			});
			const scope = await run(Scope.make());
			onTestFinished(() => run(Scope.close(scope, Exit.void)));
			await run(
				Layer.build(
					DataExportWorkerLive.pipe(
						Layer.provide(
							Layer.succeed(PgBossService, {
								boss: failing,
								schema,
							}),
						),
					),
				).pipe(Scope.provide(scope)),
			);

			const deadline = Date.now() + 10_000;
			while (
				!(await boss.getSchedules()).some(
					(schedule) => schedule.name === DATA_EXPORT_SWEEP_JOB_NAME,
				)
			) {
				if (Date.now() > deadline) throw new Error("The sweep never started");
				await sleep(50);
			}
			expect(worked).toEqual([
				DATA_EXPORT_SWEEP_JOB_NAME,
			]);
		},
		TIMEOUT,
	);
});
