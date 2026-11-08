import { W3CTraceContextPropagator } from "@opentelemetry/core";
import {
	DbConfigLive,
	DbConfigService,
	makePgConnectionString,
} from "@orcai/db";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { PgBoss } from "pg-boss";
import { PgBossError } from "./errors";

export class PgBossService extends Context.Service<
	PgBossService,
	{
		readonly boss: PgBoss;
		/** The Postgres schema pg-boss keeps its tables in. */
		readonly schema: string;
	}
>()("PgBossService") {}

const SCHEMA = "pgboss";

/** `instanceName` tells this process apart in pg-boss's instance registry. */
const pgBossServiceLayer = (options: {
	readonly instanceName: string;
}): Layer.Layer<PgBossService, PgBossError, DbConfigService> =>
	Layer.effect(
		PgBossService,
		Effect.acquireRelease(
			Effect.gen(function* () {
				yield* Effect.logInfo("Starting PgBoss service...");

				const { config } = yield* DbConfigService;

				const url = makePgConnectionString(config);

				const boss = yield* Effect.tryPromise({
					try: async () => {
						const boss = new PgBoss({
							connectionString: Redacted.value(url),
							max: config.poolMax,
							instanceName: options.instanceName,
							schema: SCHEMA,
							// Jobs carry the trace context only, never baggage.
							openTelemetry: {
								propagateContext: true,
								propagator: new W3CTraceContextPropagator(),
							},
						});
						// pg-boss re-emits pool errors on itself; without a listener a
						// terminated idle connection ends the process.
						boss.on("error", (error) => {
							console.warn(`[pg-boss] ${error.message}`);
						});
						await boss.start();
						return boss;
					},
					catch: (error) =>
						new PgBossError({
							operation: "start",
							cause: error,
						}),
				});

				yield* Effect.logInfo("PgBoss service started successfully");
				return {
					boss,
					schema: SCHEMA,
				};
			}),
			({ boss }) =>
				Effect.gen(function* () {
					yield* Effect.logInfo("Stopping PgBoss service...");
					yield* Effect.tryPromise(() =>
						boss.stop({
							graceful: true,
						}),
					).pipe(
						Effect.catch((error) =>
							Effect.logError(`Failed to stop PgBoss: ${error}`),
						),
					);
					yield* Effect.logInfo("PgBoss service stopped");
				}),
		),
	);

export const makePgBossLayer = (options: { readonly instanceName: string }) =>
	pgBossServiceLayer(options).pipe(Layer.provide(DbConfigLive));
