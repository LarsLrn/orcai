import { expect, test } from "bun:test";
import { DB } from "@orcai/db";
import { DATA_EXPORT_JOB_NAME } from "@orcai/schema";
import { integrationRuntime } from "@orcai/testing";
import * as Effect from "effect/Effect";
import { PgBossService, sendJobBatchInTransaction } from "../src";
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
