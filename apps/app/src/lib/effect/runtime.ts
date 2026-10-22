import { withActiveSpan } from "@orcai/observability";
import type * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { DataExportWorkerLive } from "@/lib/data-export/data-export-worker";
import { AppLayer } from "./app-layer";

export type AppRuntime = ManagedRuntime.ManagedRuntime<
	Layer.Success<typeof AppLayer>,
	Layer.Error<typeof AppLayer>
>;

export type AppRuntimeContext =
	ManagedRuntime.ManagedRuntime.Services<AppRuntime>;

// Ensure singleton runtime across hot module reloads in development
declare global {
	var __effectRuntime: AppRuntime | undefined;
}

if (!globalThis.__effectRuntime) {
	globalThis.__effectRuntime = ManagedRuntime.make(
		DataExportWorkerLive.pipe(Layer.provideMerge(AppLayer)),
	);
}

export const runtime: AppRuntime = globalThis.__effectRuntime;

/** Runs an effect from promise-based code as part of the caller's active trace. */
export const runPromise = <A, E>(
	effect: Effect.Effect<A, E, AppRuntimeContext>,
	options?: Effect.RunOptions,
): Promise<A> => runtime.runPromise(withActiveSpan(effect), options);
