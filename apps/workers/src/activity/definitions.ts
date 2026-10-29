import type { DB } from "@orcai/db";
import { ACTIVITY_CLEANUP_JOB_NAME } from "@orcai/schema";
import { cleanupActivityBatch } from "@/activity/jobs/cleanup-activity-job";
import type { WorkerDefinition } from "@/worker/types";

export type ActivityWorkerContext = DB;

export const activityWorkerDefinitions = [
	{
		name: ACTIVITY_CLEANUP_JOB_NAME,
		schedule: "25 * * * *",
		workOptions: {
			batchSize: 1,
			localConcurrency: 1,
			pollingIntervalSeconds: 30,
		},
		handler: cleanupActivityBatch,
	},
] as const satisfies readonly WorkerDefinition<
	ActivityWorkerContext,
	unknown
>[];
