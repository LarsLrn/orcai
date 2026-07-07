import { z } from "zod/v4";

export const PROCESS_ASSET_JOB_NAME = "process-asset-job";
export const VECTORIZE_ASSET_JOB_NAME = "vectorize-asset-job";
export const QUOTA_PERIOD_ROLLOVER_JOB_NAME = "quota-period-rollover-job";
export const QUOTA_RECONCILE_JOB_NAME = "quota-reconcile-job";
export const QUOTA_DAILY_VERIFY_JOB_NAME = "quota-daily-verify-job";
export const NOTIFICATION_OUTBOX_JOB_NAME = "notification-outbox-job";
export const NOTIFICATION_OUTBOX_CLEANUP_JOB_NAME =
	"notification-outbox-cleanup-job";

export const jobQueues = z.enum([
	PROCESS_ASSET_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
	QUOTA_PERIOD_ROLLOVER_JOB_NAME,
	QUOTA_RECONCILE_JOB_NAME,
	QUOTA_DAILY_VERIFY_JOB_NAME,
	NOTIFICATION_OUTBOX_JOB_NAME,
	NOTIFICATION_OUTBOX_CLEANUP_JOB_NAME,
]);

export type JobQueue = z.infer<typeof jobQueues>;
