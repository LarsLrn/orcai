import { PgBossWorkersError } from "@/lib/effect/utils/errors";
import type { JobQueue } from "../schema/job-queues";

export const toPgBossRunError =
	(jobId: string, queue: JobQueue) => (cause: unknown) =>
		new PgBossWorkersError({
			queue,
			jobId,
			step: "run-worker",
			cause,
		});
