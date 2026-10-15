import handler from "@tanstack/react-start/server-entry";
import { ensureRuntimeReady, runtime } from "./lib/effect/runtime";
import { installZodErrorMap } from "./lib/errors/zod-error-map";
import { traceRequest } from "./lib/observability/request-span";
import { paraglideMiddleware } from "./paraglide/server.js";
import { getRouter } from "./router";

installZodErrorMap();

// Eagerly initialize the runtime and forces all layers to build.
// If any layer fails, the process exits immediately before serving requests.
const runtimeReady = ensureRuntimeReady().catch((error) => {
	console.error("Failed to initialize AppLayer:", error);
	process.exit(1);
});

// Graceful shutdown
// Disposes the runtime so all finalizers run in order
const shutdown = () => {
	runtime
		.dispose()
		.then(() => {
			console.log("Effect runtime disposed successfully");
			process.exit(0);
		})
		.catch((error) => {
			console.error("Failed to dispose effect runtime:", error);
			process.exit(1);
		});
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

// Only matches request paths to route templates for span names.
const routeMatcher = getRouter();

export default {
	async fetch(req: Request): Promise<Response> {
		// The tracer provider is registered while the runtime builds.
		await runtimeReady;
		return traceRequest(req, routeMatcher, () =>
			paraglideMiddleware(req, () => handler.fetch(req)),
		);
	},
};
