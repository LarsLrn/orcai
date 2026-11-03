import { PgClient } from "@effect/sql-pg";
import type { JobQueue } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { PgBossError } from "./errors";
import { PgBossService } from "./service";

/**
 * pg-boss's queries on the current SQL connection, so jobs sent inside a
 * transaction commit or roll back with it.
 */
const currentConnection = Effect.gen(function* () {
	const sql = yield* PgClient.PgClient;
	const context = yield* Effect.context<never>();
	return {
		executeSql: (text: string, values: unknown[] = []) =>
			Effect.runPromiseWith(context)(
				sql.unsafe<Record<string, unknown>>(text, values),
			).then((rows) => ({
				rows: [
					...rows,
				],
			})),
	};
});

type JobBatch<T> = {
	jobName: JobQueue;
	jobs: Array<{
		data: T;
		options?: {
			/** Seconds before the job may run. */
			startAfter?: number;
		};
	}>;
};

const insertJobs = <T extends object>(
	params: JobBatch<T>,
	options: Parameters<PgBossService["Service"]["boss"]["insert"]>[2],
) =>
	Effect.gen(function* () {
		const { boss } = yield* PgBossService;

		yield* Effect.tryPromise({
			try: () =>
				boss.insert(
					params.jobName,
					params.jobs.map((job) => ({
						data: job.data,
						startAfter: job.options?.startAfter,
					})),
					options,
				),
			catch: (error) =>
				new PgBossError({
					operation: "send",
					queue: params.jobName,
					cause: error,
				}),
		});
	});

/** The payloads of the queues' jobs that wait, wait to retry or run. */
export const liveJobs = <T>(queues: readonly JobQueue[]) =>
	Effect.gen(function* () {
		const { schema } = yield* PgBossService;
		const sql = yield* PgClient.PgClient;
		return yield* sql.unsafe<{
			name: JobQueue;
			data: T;
		}>(
			`SELECT name, data FROM ${schema}.job WHERE name = ANY($1) AND state < 'completed'`,
			[
				queues,
			],
		);
	}).pipe(
		Effect.mapError(
			(cause) =>
				new PgBossError({
					operation: "query",
					cause,
				}),
		),
	);

/**
 * Send multiple jobs in batch.
 */
export const sendJobBatch = <T extends object = object>(params: JobBatch<T>) =>
	insertJobs(params, {});

/** Sends the jobs on the current transaction: they are queued only if it commits. */
export const sendJobBatchInTransaction = <T extends object = object>(
	params: JobBatch<T>,
) =>
	currentConnection.pipe(
		Effect.flatMap((db) =>
			insertJobs(params, {
				db,
			}),
		),
	);
