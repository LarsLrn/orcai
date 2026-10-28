import { createFileRoute } from "@tanstack/react-router";
import { runPromise } from "@/lib/effect/runtime";
import {
	coreDependenciesHealthy,
	readinessResponse,
} from "@/lib/health/health";

/** Readiness for container orchestration: no session, no detail. */
export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: () => readinessResponse(() => runPromise(coreDependenciesHealthy)),
		},
	},
});
