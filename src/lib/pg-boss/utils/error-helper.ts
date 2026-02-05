import { PgBossWorkersError } from "@/lib/effect/utils/errors";
import type { JobQueue } from "@/lib/pg-boss/schema/job";

export const toPgBossRunError =
	(jobId: string, queue: JobQueue) => (cause: unknown) =>
		new PgBossWorkersError({
			queue,
			jobId,
			step: "run-worker",
			cause,
		});
