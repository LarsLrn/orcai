import { defineWorker } from "@orcai/pg-boss";
import { DATA_EXPORT_EXPIRE_JOB_NAME } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { expireDataExports } from "@/data-export/jobs/expire-data-exports-job";

export const dataExportWorkers = [
	defineWorker({
		queue: DATA_EXPORT_EXPIRE_JOB_NAME,
		concurrency: 1,
		pollingIntervalSeconds: 30,
		handler: () => expireDataExports().pipe(Effect.asVoid),
	}),
];
