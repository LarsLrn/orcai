import type { ProbeResult } from "@orcai/core";
import * as Effect from "effect/Effect";
import { PgBossError } from "./errors";
import { PgBossService } from "./service";

/** A process that runs pg-boss against this database, as of its last heartbeat. */
interface PgBossProcess {
	readonly name: string | null;
	readonly host: string;
	readonly pid: number;
	readonly live: boolean;
	readonly startedOn: Date;
	readonly heartbeatOn: Date;
	readonly lastWorkerErrorOn: Date | null;
}

interface PgBossQueueCounts {
	readonly name: string;
	readonly deadLetter: string | null;
	readonly queued: number;
	readonly active: number;
	readonly failed: number;
}

export interface PgBossProbeResult extends ProbeResult {
	readonly processes: readonly PgBossProcess[];
	readonly queues: readonly PgBossQueueCounts[];
}

const latest = (dates: readonly (string | null)[]) =>
	dates.reduce<Date | null>((newest, value) => {
		if (!value) return newest;
		const date = new Date(value);
		return !newest || date > newest ? date : newest;
	}, null);

export const probePgBoss = Effect.gen(function* () {
	const { boss } = yield* PgBossService;
	const [instances, queues] = yield* Effect.tryPromise({
		try: () =>
			Promise.all([
				boss.getInstances(),
				boss.getQueues(),
			]),
		catch: (cause) =>
			new PgBossError({
				operation: "query",
				cause,
			}),
	});

	return {
		ok: true,
		processes: instances
			.filter((instance) => instance.stoppedOn === null)
			.map((instance) => ({
				name: instance.name,
				host: instance.host,
				pid: instance.pid,
				live: instance.live,
				startedOn: instance.startedOn,
				heartbeatOn: instance.heartbeatOn,
				lastWorkerErrorOn: latest(
					instance.workers.map((worker) => worker.lastErrorOn),
				),
			})),
		queues: queues
			// pg-boss keeps its own queues under this prefix.
			.filter((queue) => !queue.name.startsWith("__pgboss__"))
			.map((queue) => ({
				name: queue.name,
				deadLetter: queue.deadLetter ?? null,
				queued: queue.queuedCount,
				active: queue.activeCount,
				failed: queue.failedCount,
			})),
	} satisfies PgBossProbeResult;
});
