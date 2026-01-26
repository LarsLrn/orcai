import handler from "@tanstack/react-start/server-entry";
import { initOtel } from "./lib/observability/instrumentation";
import { startPgBossWorkers } from "./lib/pg-boss/worker";
import { paraglideMiddleware } from "./paraglide/server.js";

// Initialize OpenTelemetry instrumentation
initOtel();

// Initialize pg-boss workers
startPgBossWorkers().catch((error) => {
	console.error("Failed to start pg-boss workers:", error);
});

export default {
	fetch(req: Request): Promise<Response> {
		return paraglideMiddleware(req, () => handler.fetch(req));
	},
};
