import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import { logErrorCause } from "@orcai/observability";
import {
	type PgBossService,
	runWorkers,
	startupRetry,
	type WorkerDefinition,
} from "@orcai/pg-boss";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import type * as Layer from "effect/Layer";
import * as Runtime from "effect/Runtime";

/** A signal interrupts the workers, which is a clean stop. */
const teardown: Runtime.Teardown = (exit, onExit) =>
	Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)
		? onExit(0)
		: Runtime.defaultTeardown(exit, onExit);

export const runWorkerProcess = <R, E>(params: {
	name: string;
	layer: Layer.Layer<R | PgBossService, E, never>;
	workers: readonly WorkerDefinition<never, R | PgBossService>[];
	/** Runs once at boot; a failure is logged and does not stop the workers. */
	setup?: Effect.Effect<void, unknown, R | PgBossService>;
}) =>
	Effect.gen(function* () {
		yield* Effect.logInfo(`Starting ${params.name}...`);
		yield* runWorkers(params.workers);
		if (params.setup) {
			yield* params.setup.pipe(
				Effect.retry(startupRetry),
				Effect.catchCause((cause) =>
					logErrorCause(`${params.name} setup failed`, cause),
				),
			);
		}
		yield* Effect.logInfo(`${params.name} started`);
	}).pipe(
		Effect.withSpan("workers.startup"),
		Effect.andThen(Effect.never),
		Effect.scoped,
		Effect.onInterrupt(() => Effect.logInfo(`Stopping ${params.name}...`)),
		Effect.provide(params.layer),
		BunRuntime.runMain({
			teardown,
		}),
	);
