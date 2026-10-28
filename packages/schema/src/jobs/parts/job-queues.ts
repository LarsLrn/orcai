import { z } from "zod/v4";

export const PROCESS_ASSET_JOB_NAME = "process-asset-job";
export const VECTORIZE_ASSET_JOB_NAME = "vectorize-asset-job";
export const PROCESS_ASSET_DEAD_LETTER_JOB_NAME =
	"process-asset-dead-letter-job";
export const VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME =
	"vectorize-asset-dead-letter-job";
export const GENERATE_ASSET_METADATA_JOB_NAME = "generate-asset-metadata-job";
export const GENERATE_ASSET_METADATA_DEAD_LETTER_JOB_NAME =
	"generate-asset-metadata-dead-letter-job";
export const QUOTA_PERIOD_ROLLOVER_JOB_NAME = "quota-period-rollover-job";
export const QUOTA_RELEASE_STALE_JOB_NAME = "quota-release-stale-job";
export const NOTIFICATION_OUTBOX_JOB_NAME = "notification-outbox-job";
export const NOTIFICATION_OUTBOX_CLEANUP_JOB_NAME =
	"notification-outbox-cleanup-job";

export const DATA_EXPORT_JOB_NAME = "data-export-job";
export const DATA_EXPORT_DEAD_LETTER_JOB_NAME = "data-export-dead-letter-job";
export const DATA_EXPORT_EXPIRE_JOB_NAME = "data-export-expire-job";

export const jobQueues = z.enum([
	PROCESS_ASSET_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
	PROCESS_ASSET_DEAD_LETTER_JOB_NAME,
	VECTORIZE_ASSET_DEAD_LETTER_JOB_NAME,
	GENERATE_ASSET_METADATA_JOB_NAME,
	GENERATE_ASSET_METADATA_DEAD_LETTER_JOB_NAME,
	QUOTA_PERIOD_ROLLOVER_JOB_NAME,
	QUOTA_RELEASE_STALE_JOB_NAME,
	NOTIFICATION_OUTBOX_JOB_NAME,
	NOTIFICATION_OUTBOX_CLEANUP_JOB_NAME,
	DATA_EXPORT_JOB_NAME,
	DATA_EXPORT_DEAD_LETTER_JOB_NAME,
	DATA_EXPORT_EXPIRE_JOB_NAME,
]);

export type JobQueue = z.infer<typeof jobQueues>;
