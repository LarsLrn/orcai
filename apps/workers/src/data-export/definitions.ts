import type { S3Service } from "@orcai/s3/server";
import { DATA_EXPORT_EXPIRE_JOB_NAME } from "@orcai/schema";
import { expireDataExportsBatch } from "@/data-export/jobs/expire-data-exports-job";
import type { WorkerDefinition } from "@/worker/types";

export type DataExportWorkerContext = S3Service;

export const dataExportWorkerDefinitions = [
	{
		name: DATA_EXPORT_EXPIRE_JOB_NAME,
		schedule: "*/10 * * * *",
		workOptions: {
			batchSize: 1,
			localConcurrency: 1,
			pollingIntervalSeconds: 30,
		},
		handler: expireDataExportsBatch,
	},
] as const satisfies readonly WorkerDefinition<
	DataExportWorkerContext,
	unknown
>[];
