import { defineWorker } from "@orcai/pg-boss";
import { ACTIVITY_CLEANUP_JOB_NAME } from "@orcai/schema";
import { cleanupActivity } from "@/activity/jobs/cleanup-activity-job";

export const activityWorkers = [
	defineWorker({
		queue: ACTIVITY_CLEANUP_JOB_NAME,
		concurrency: 1,
		pollingIntervalSeconds: 30,
		handler: () => cleanupActivity,
	}),
];
