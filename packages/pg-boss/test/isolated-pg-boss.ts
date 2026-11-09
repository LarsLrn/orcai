import { onTestFinished } from "bun:test";
import {
	DB,
	DbConfigLive,
	DbConfigService,
	DrizzleLive,
	makePgConnectionString,
} from "@orcai/db";
import { type JobQueue, jobQueues } from "@orcai/schema";
import { sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { type ConstructorOptions, PgBoss, type TestClock } from "pg-boss";
import { ensureQueues } from "../src/queues";
import { PgBossService } from "../src/service";
import type { WorkerDefinition } from "../src/worker";

/**
 * pg-boss in a schema of its own, so no other test file sees or wakes its
 * jobs, with `queues` and their dead letter queues, every queue by default.
 * Errors are logged, as in production. The schema goes when the scope closes.
 */
export const IsolatedPgBossLive = ({
	queues = jobQueues.options,
	...options
}: Pick<
	ConstructorOptions,
	"clock" | "supervise" | "superviseIntervalSeconds" | "monitorIntervalSeconds"
> & {
	readonly queues?: readonly JobQueue[];
} = {}) =>
	Layer.effectContext(
		Effect.gen(function* () {
			const { config } = yield* DbConfigService;
			const db = yield* DB;
			const schema = `pgboss_test_${crypto.randomUUID().replaceAll("-", "")}`;
			// Registered first, so a start or stop that fails still drops the schema.
			yield* Effect.addFinalizer(() =>
				db
					.execute(sql.raw(`DROP SCHEMA IF EXISTS ${schema} CASCADE`))
					.pipe(Effect.orDie),
			);
			const boss = new PgBoss({
				connectionString: Redacted.value(makePgConnectionString(config)),
				schema,
				// Test files run in parallel against one Postgres, so each keeps few
				// connections and runs no maintenance unless it asks for it.
				max: 2,
				supervise: false,
				schedule: false,
				...options,
			});
			boss.on("error", (error) => {
				console.warn(`[pg-boss ${schema}] ${error.message}`);
			});
			yield* Effect.addFinalizer(() =>
				Effect.tryPromise(() =>
					boss.stop({
						graceful: false,
					}),
				).pipe(
					Effect.catch((error) =>
						Effect.logWarning(`Failed to stop pg-boss ${schema}: ${error}`),
					),
				),
			);
			yield* Effect.promise(() => boss.start());
			const service = Context.make(PgBossService, {
				boss,
				schema,
			});
			yield* ensureQueues(queues).pipe(Effect.provide(service), Effect.orDie);
			return service;
		}),
	).pipe(Layer.provide(Layer.mergeAll(DbConfigLive, DrizzleLive)));

/**
 * Moves a test clock on only as fast as the tracked workers' handlers run,
 * so no wall-clock wait decides what pg-boss sees.
 */
export const clockSteps = (clock: TestClock) => {
	const running = new Set<Promise<void>>();
	return {
		/** The definitions, each handler call tracked until it returns or is interrupted. */
		track: <R>(
			definitions: readonly WorkerDefinition<never, R>[],
		): WorkerDefinition<never, R>[] =>
			definitions.map((definition) => ({
				...definition,
				handler: (job) =>
					Effect.suspend(() => {
						const call = Promise.withResolvers<void>();
						running.add(call.promise);
						return definition.handler(job).pipe(
							Effect.ensuring(
								Effect.sync(() => {
									running.delete(call.promise);
									call.resolve();
								}),
							),
						);
					}),
			})),
		/**
		 * Moves the clock on in steps of `stepMs` until `condition` holds, for at
		 * most `maxSteps` steps and no longer than the test. A handler call a
		 * step starts gets the next step to end in: a step shorter than its
		 * queue's expiry waits for it to return, a longer one expires it.
		 */
		until: async (
			condition: () => Promise<boolean>,
			what: string,
			stepMs: number,
			maxSteps = 100,
		) => {
			let finished = false;
			onTestFinished(() => {
				finished = true;
			});
			for (let step = 0; !(await condition()); step++) {
				if (finished) return;
				if (step === maxSteps) {
					throw new Error(
						`Waited ${maxSteps} steps of ${stepMs} ms for ${what}`,
					);
				}
				const started = [
					...running,
				];
				await clock.setTime(clock.now() + stepMs);
				await clock.tick(1);
				await Promise.all(started);
			}
		},
	};
};
