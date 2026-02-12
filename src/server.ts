import handler from "@tanstack/react-start/server-entry";
import { ensureRuntimeReady, runtime } from "./lib/effect/runtime";
import { paraglideMiddleware } from "./paraglide/server.js";

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

export default {
	async fetch(req: Request): Promise<Response> {
		await runtimeReady;
		return paraglideMiddleware(req, () => handler.fetch(req));
	},
};
