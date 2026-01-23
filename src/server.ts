import "./instrumentation";

import handler from "@tanstack/react-start/server-entry";
import { startPgBossWorkers } from "./lib/pg-boss/worker";
import { paraglideMiddleware } from "./paraglide/server.js";

// Initialize pg-boss workers
startPgBossWorkers().catch((error) => {
	console.error("Failed to start pg-boss workers:", error);
});

export default {
	fetch(req: Request): Promise<Response> {
		return paraglideMiddleware(req, () => handler.fetch(req));
	},
};
