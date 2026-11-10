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
			/** Splits a stately queue: its one waiting and one running job are per key. */
			singletonKey?: string;
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
						singletonKey: job.options?.singletonKey,
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

/**
 * Payloads whose texts at `paths` equal one of `values`, each value a tuple
 * in the order of `paths`.
 */
export type JobMatch = {
	readonly paths: readonly (readonly string[])[];
	readonly values: readonly (readonly string[])[];
};

/**
 * The queues' jobs that wait, wait to retry or run, with their payloads;
 * with `matching`, only the jobs it matches.
 */
export const liveJobs = <T>(queues: readonly JobQueue[], matching?: JobMatch) =>
	Effect.gen(function* () {
		if (
			matching &&
			(matching.values.length === 0 || matching.paths.length === 0)
		)
			return [];
		const { schema } = yield* PgBossService;
		const sql = yield* PgClient.PgClient;
		const paths = matching?.paths ?? [];
		const columns = paths.map((_, index) =>
			(matching?.values ?? []).map((value) => value[index]),
		);
		const keys = paths
			.map((_, index) => `data #>> $${index + 2 + paths.length}::text[]`)
			.join(", ");
		const unnested = paths
			.map((_, index) => `$${index + 2}::text[]`)
			.join(", ");
		return yield* sql.unsafe<{
			name: JobQueue;
			state: "created" | "retry" | "active";
			data: T;
		}>(
			`SELECT name, state, data FROM ${schema}.job WHERE name = ANY($1) AND state < 'completed'${
				matching ? ` AND (${keys}) IN (SELECT * FROM unnest(${unnested}))` : ""
			}`,
			[
				queues,
				...columns,
				...paths,
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
