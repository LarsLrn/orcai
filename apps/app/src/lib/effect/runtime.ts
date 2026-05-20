import * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
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
	var __effectRuntimeReady: Promise<void> | undefined;
}

if (!globalThis.__effectRuntime) {
	globalThis.__effectRuntime = ManagedRuntime.make(AppLayer);
}

export const runtime: AppRuntime = globalThis.__effectRuntime;

/**
 * Initializes the runtime once and reuses the same promise across calls.
 * Useful to gate request handling until the full AppLayer is ready.
 */
export const ensureRuntimeReady = (): Promise<void> => {
	if (!globalThis.__effectRuntimeReady) {
		globalThis.__effectRuntimeReady = runtime
			.runPromise(Effect.logInfo("Effect runtime initialized successfully"))
			.then(() => undefined);
	}

	return globalThis.__effectRuntimeReady;
};
