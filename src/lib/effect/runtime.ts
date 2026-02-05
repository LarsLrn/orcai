import type * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { AppLayer } from "./app-layer";

export type AppRuntime = ManagedRuntime.ManagedRuntime<
	Layer.Layer.Success<typeof AppLayer>,
	Layer.Layer.Error<typeof AppLayer>
>;

export type AppRuntimeContext =
	ManagedRuntime.ManagedRuntime.Context<AppRuntime>;

// Ensure singleton runtime across hot module reloads in development
declare global {
	var __effectRuntime: AppRuntime | undefined;
}

if (!globalThis.__effectRuntime) {
	globalThis.__effectRuntime = ManagedRuntime.make(AppLayer);
}

export const runtime: AppRuntime = globalThis.__effectRuntime;
