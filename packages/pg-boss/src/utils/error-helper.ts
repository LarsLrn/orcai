import type { JobQueue } from "@orcai/schema";
import { PgBossWorkersError } from "../errors";

export const toPgBossRunError =
	(jobId: string, queue: JobQueue) => (cause: unknown) =>
		new PgBossWorkersError({
			queue,
			jobId,
			step: "run-worker",
			cause,
		});
