import type { JobQueue } from "@orcai/schema";
import * as Data from "effect/Data";

export class PgBossError extends Data.TaggedError("PgBossError")<{
	readonly operation: "start" | "query" | "send";
	readonly queue?: JobQueue;
	readonly cause: unknown;
}> {}

export class PgBossWorkersError extends Data.TaggedError("PgBossWorkerError")<{
	/** A removed worker's queue is no longer a JobQueue. */
	readonly queue: string;
	readonly step:
		| "create-queue"
		| "register-worker"
		| "schedule-worker"
		| "unschedule-worker";
	readonly cause: unknown;
}> {}
