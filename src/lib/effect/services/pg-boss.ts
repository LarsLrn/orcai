import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { PgBoss } from "pg-boss";
import { makePgConnectionString } from "@/db/pg-connection-string";
import { PgBossError } from "@/lib/effect/utils/errors";
import { AppConfigService } from "./config";

export class PgBossService extends Context.Tag("PgBossService")<
	PgBossService,
	{
		readonly boss: PgBoss;
	}
>() {}

export const PgBossLive = Layer.scoped(
	PgBossService,
	Effect.acquireRelease(
		Effect.gen(function* () {
			yield* Effect.logInfo("Starting PgBoss service...");

			const { config } = yield* AppConfigService;

			const url = makePgConnectionString(config.postgres);

			const boss = yield* Effect.tryPromise({
				try: async () => {
					const boss = new PgBoss({
						connectionString: Redacted.value(url),
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
					Effect.catchAll((error) =>
						Effect.logError(`Failed to stop PgBoss: ${error}`),
					),
				);
				yield* Effect.logInfo("PgBoss service stopped");
			}),
	),
);
