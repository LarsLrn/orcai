import {
	DB,
	DbConfigLive,
	DbConfigService,
	DrizzleLive,
	makePgConnectionString,
} from "@orcai/db";
import { jobQueues } from "@orcai/schema";
import { sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { type ConstructorOptions, PgBoss } from "pg-boss";
import { ensureQueues } from "../src/queues";
import { PgBossService } from "../src/service";

/**
 * pg-boss in a schema of its own with every queue of the queue table, so no
 * other test file sees or wakes its jobs. Errors are logged, as in
 * production. The schema goes when the scope closes.
 */
export const IsolatedPgBossLive = (
	options: Pick<
		ConstructorOptions,
		| "clock"
		| "supervise"
		| "superviseIntervalSeconds"
		| "monitorIntervalSeconds"
	> = {},
) =>
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
			yield* ensureQueues(jobQueues.options).pipe(
				Effect.provide(service),
				Effect.orDie,
			);
			return service;
		}),
	).pipe(Layer.provide(Layer.mergeAll(DbConfigLive, DrizzleLive)));
