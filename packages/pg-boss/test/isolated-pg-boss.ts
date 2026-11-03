import {
	DB,
	DbConfigLive,
	DbConfigService,
	DrizzleLive,
	makePgConnectionString,
} from "@orcai/db";
import { JOB_QUEUE_POLICIES, jobQueues } from "@orcai/schema";
import { sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { type ConstructorOptions, PgBoss } from "pg-boss";
import { PgBossService } from "../src/service";

/** The schema `IsolatedPgBossLive` keeps its jobs in, for a test that reads them in SQL. */
export class PgBossSchema extends Context.Service<PgBossSchema, string>()(
	"PgBossSchema",
) {}

/**
 * pg-boss in a schema of its own with every queue the workers create, so no
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
				connectionString: Redacted.value(
					makePgConnectionString(config.postgres),
				),
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
			yield* Effect.promise(async () => {
				await boss.start();
				for (const name of jobQueues.options) {
					await boss.createQueue(name, {
						policy: JOB_QUEUE_POLICIES[name],
					});
				}
			});
			return Context.make(PgBossService, {
				boss,
			}).pipe(Context.add(PgBossSchema, schema));
		}),
	).pipe(Layer.provide(Layer.mergeAll(DbConfigLive, DrizzleLive)));
