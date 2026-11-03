import { expect, test } from "bun:test";
import { PgClient } from "@effect/sql-pg";
import { integrationRuntime } from "@orcai/testing";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import { type AttachableClock, systemClock } from "pg-boss";
import { IsolatedPgBossLive } from "./isolated-pg-boss";

const { runPromise: run } = integrationRuntime();

test("a setup that fails once the schema exists leaves no schema behind", async () => {
	let schema: string | undefined;
	// pg-boss attaches the clock on start, after it installed the schema.
	const clock: AttachableClock = {
		now: () => systemClock.now(),
		setTimeout: (fn, ms) => systemClock.setTimeout(fn, ms),
		clearTimeout: (handle) => systemClock.clearTimeout(handle),
		setInterval: (fn, ms) => systemClock.setInterval(fn, ms),
		clearInterval: (handle) => systemClock.clearInterval(handle),
		attach: (target) => {
			schema = target.schema;
			return Promise.reject(new Error("attach failed"));
		},
	};

	const exit = await run(
		Effect.exit(
			Effect.scoped(
				Layer.build(
					IsolatedPgBossLive({
						clock,
					}),
				),
			),
		),
	);

	expect(Exit.isFailure(exit)).toBe(true);
	expect(schema).toStartWith("pgboss_test_");
	const [{ exists }] = await run(
		Effect.gen(function* () {
			const sql = yield* PgClient.PgClient;
			return yield* sql<{
				exists: boolean;
			}>`SELECT exists (SELECT 1 FROM pg_namespace WHERE nspname = ${schema}) AS exists`;
		}),
	);
	expect(exists).toBe(false);
});
