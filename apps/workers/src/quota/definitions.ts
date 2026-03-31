import type { DB } from "@orcai/db";
import type { QuotaCounterStore } from "@orcai/quota";
import {
	type JobQueue,
	QUOTA_DAILY_VERIFY_JOB_NAME,
	QUOTA_PERIOD_ROLLOVER_JOB_NAME,
	QUOTA_RECONCILE_JOB_NAME,
} from "@orcai/schema";
import { verifyQuotaDailyBatchEffect } from "@/quota/jobs/quota-daily-verify-job";
import { rolloverQuotaPeriodBatchEffect } from "@/quota/jobs/quota-period-rollover-job";
import { reconcileQuotaBatchEffect } from "@/quota/jobs/quota-reconcile-job";
import type { WorkerDefinition } from "@/worker/types";

export type QuotaWorkerContext = DB | QuotaCounterStore;

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
		name: QUOTA_RECONCILE_JOB_NAME as JobQueue,
		workOptions: {
			batchSize: 1,
			localConcurrency: 1,
			pollingIntervalSeconds: 5,
		},
		schedule: "*/2 * * * *",
		handler: reconcileQuotaBatchEffect,
	}),
	quotaWorker({
		name: QUOTA_DAILY_VERIFY_JOB_NAME as JobQueue,
		workOptions: {
			batchSize: 1,
			localConcurrency: 1,
			pollingIntervalSeconds: 30,
		},
		schedule: "0 2 * * *",
		handler: verifyQuotaDailyBatchEffect,
	}),
];
