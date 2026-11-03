import { defineWorker } from "@orcai/pg-boss";
import {
	QUOTA_PERIOD_ROLLOVER_JOB_NAME,
	QUOTA_RELEASE_STALE_JOB_NAME,
} from "@orcai/schema";
import { rollOverExpiredQuotaPeriods } from "@/quota/jobs/quota-period-rollover-job";
import { releaseStaleQuota } from "@/quota/jobs/quota-release-stale-job";

export const quotaWorkers = [
	defineWorker({
		queue: QUOTA_PERIOD_ROLLOVER_JOB_NAME,
		concurrency: 1,
		pollingIntervalSeconds: 5,
		handler: () => rollOverExpiredQuotaPeriods,
	}),
	defineWorker({
		queue: QUOTA_RELEASE_STALE_JOB_NAME,
		concurrency: 1,
		pollingIntervalSeconds: 5,
		handler: () => releaseStaleQuota,
	}),
];
