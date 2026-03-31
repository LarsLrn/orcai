import type { JobQueue } from "@orcai/schema";
import * as Data from "effect/Data";

export const ErrorTags = {
	PG_BOSS: "PgBossError",
	PG_BOSS_WORKER: "PgBossWorkerError",
} as const;

export class PgBossError extends Data.TaggedError(ErrorTags.PG_BOSS)<{
	readonly operation:
		| "start"
		| "stop"
		| "run"
		| "query"
		| "send"
		| "cancel"
		| "pause"
		| "resume";
	readonly queue?: JobQueue;
	readonly jobId?: string;
	readonly cause: unknown;
}> {}

export class PgBossWorkersError extends Data.TaggedError(
	ErrorTags.PG_BOSS_WORKER,
)<{
	readonly queue: JobQueue;
	readonly step:
		| "create-queue"
		| "register-worker"
		| "run-worker"
		| "schedule-worker";
	readonly jobId?: string;
	readonly cause: unknown;
}> {}
