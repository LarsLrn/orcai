import type { Job } from "@orcai/pg-boss";
import type { JobQueue } from "@orcai/schema";
import type * as Effect from "effect/Effect";

export interface WorkerDefinition<TContext, TPayload = unknown> {
	readonly name: JobQueue;
	readonly workOptions: {
		readonly batchSize: number;
		readonly localConcurrency: number;
		readonly pollingIntervalSeconds: number;
	};
	readonly schedule?: string;
	readonly handler: (
		jobs: Job<TPayload>[],
	) => Effect.Effect<void, unknown, TContext>;
}
