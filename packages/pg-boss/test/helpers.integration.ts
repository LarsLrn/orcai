import { expect, test } from "bun:test";
import { DB } from "@orcai/db";
import { DATA_EXPORT_JOB_NAME } from "@orcai/schema";
import { integrationRuntime } from "@orcai/testing";
import * as Effect from "effect/Effect";
import { liveJobs, PgBossService, sendJobBatchInTransaction } from "../src";
import { IsolatedPgBossLive } from "./isolated-pg-boss";

const { runPromise: run } = integrationRuntime(IsolatedPgBossLive());

test("a job sent in a transaction is queued only if it commits", async () => {
	const send = (marker: string, outcome: Effect.Effect<void, string>) =>
		run(
			Effect.gen(function* () {
				const db = yield* DB;
				yield* db.transaction(() =>
					sendJobBatchInTransaction({
						jobName: DATA_EXPORT_JOB_NAME,
						jobs: [
							{
								data: {
									marker,
								},
							},
						],
					}).pipe(Effect.andThen(outcome)),
				);
			}).pipe(Effect.ignore),
		);
	const queuedWith = (marker: string) =>
		run(
			Effect.gen(function* () {
				const { boss } = yield* PgBossService;
				const jobs = yield* Effect.promise(() =>
					boss.findJobs(DATA_EXPORT_JOB_NAME, {
						data: {
							marker,
						},
					}),
				);
				return jobs.length;
			}),
		);
	const committed = crypto.randomUUID();
	const rolledBack = crypto.randomUUID();

	await send(committed, Effect.void);
	await send(rolledBack, Effect.fail("crash after the send"));

	expect(await queuedWith(committed)).toBe(1);
	expect(await queuedWith(rolledBack)).toBe(0);
});

test("live jobs matching values read only the jobs whose payload fields equal one", async () => {
	const [first, second] = [
		crypto.randomUUID(),
		crypto.randomUUID(),
	];
	const payload = (id: string, generation: number) => ({
		assetRef: {
			id,
		},
		generation,
	});
	const live = await run(
		Effect.gen(function* () {
			const { boss } = yield* PgBossService;
			yield* Effect.promise(() =>
				boss.insert(DATA_EXPORT_JOB_NAME, [
					{
						data: payload(first, 1),
					},
					{
						data: payload(first, 2),
					},
					{
						data: payload(second, 1),
					},
				]),
			);
			return yield* liveJobs<object>(
				[
					DATA_EXPORT_JOB_NAME,
				],
				{
					paths: [
						[
							"assetRef",
							"id",
						],
						[
							"generation",
						],
					],
					values: [
						[
							first,
							"1",
						],
						[
							second,
							"1",
						],
					],
				},
			);
		}),
	);

	expect(live.map((job) => job.data)).toEqual(
		expect.arrayContaining([
			payload(first, 1),
			payload(second, 1),
		]),
	);
	expect(live).toHaveLength(2);
});
