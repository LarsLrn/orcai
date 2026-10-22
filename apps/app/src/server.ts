import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import handler from "@tanstack/react-start/server-entry";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Runtime from "effect/Runtime";
import { runtime } from "./lib/effect/runtime";
import { installZodErrorMap } from "./lib/errors/zod-error-map";
import { traceRequest } from "./lib/observability/request-span";
import { paraglideMiddleware } from "./paraglide/server.js";
import { getRouter } from "./router";

installZodErrorMap();

/** A signal interrupts the server, which is a clean stop. */
const teardown: Runtime.Teardown = (exit, onExit) =>
	Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)
		? onExit(0)
		: Runtime.defaultTeardown(exit, onExit);

// Builds every layer at boot, so a failing one exits before serving requests.
runtime.contextEffect.pipe(
	Effect.flatMap((context) =>
		Effect.logInfo("Effect runtime initialized successfully").pipe(
			Effect.provideContext(context),
		),
	),
	Effect.andThen(Effect.never),
	Effect.ensuring(runtime.disposeEffect),
	BunRuntime.runMain({
		teardown,
	}),
);

// Only matches request paths to route templates for span names.
const routeMatcher = getRouter();

export default {
	async fetch(req: Request): Promise<Response> {
		// The tracer provider is registered while the runtime builds.
		await runtime.context();
		return traceRequest(req, routeMatcher, () =>
			paraglideMiddleware(req, () => handler.fetch(req)),
		);
	},
};
