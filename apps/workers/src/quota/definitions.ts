import type { DB } from "@orcai/db";
import {
	type JobQueue,
	QUOTA_PERIOD_ROLLOVER_JOB_NAME,
	QUOTA_RELEASE_STALE_JOB_NAME,
} from "@orcai/schema";
import { rolloverQuotaPeriodBatchEffect } from "@/quota/jobs/quota-period-rollover-job";
import { releaseStaleQuotaBatchEffect } from "@/quota/jobs/quota-release-stale-job";
import type { WorkerDefinition } from "@/worker/types";

export type QuotaWorkerContext = DB;

type QuotaWorkerDefinition = WorkerDefinition<QuotaWorkerContext> & {
	readonly schedule: string;
};

const quotaWorker = (
	definition: QuotaWorkerDefinition,
): QuotaWorkerDefinition => definition;

export const quotaWorkerDefinitions: readonly QuotaWorkerDefinition[] = [
	quotaWorker({
		name: QUOTA_PERIOD_ROLLOVER_JOB_NAME as JobQueue,
		workOptions: {
			batchSize: 1,
			localConcurrency: 1,
			pollingIntervalSeconds: 5,
		},
		schedule: "*/5 * * * *",
		handler: rolloverQuotaPeriodBatchEffect,
	}),
	quotaWorker({
		name: QUOTA_RELEASE_STALE_JOB_NAME as JobQueue,
		workOptions: {
			batchSize: 1,
			localConcurrency: 1,
			pollingIntervalSeconds: 5,
		},
		schedule: "*/5 * * * *",
		handler: releaseStaleQuotaBatchEffect,
	}),
];
