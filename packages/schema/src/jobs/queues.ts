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

export const ACTIVITY_CLEANUP_JOB_NAME = "activity-cleanup-job";

export const RECONCILE_EMBEDDINGS_JOB_NAME = "reconcile-embeddings-job";
export const PREPARE_ASSETS_AGAIN_JOB_NAME = "prepare-assets-again-job";
export const PREPARATION_SWEEP_JOB_NAME = "preparation-sweep-job";
export const DELETION_CLEANUP_JOB_NAME = "deletion-cleanup-job";

export const DATA_EXPORT_JOB_NAME = "data-export-job";
export const DATA_EXPORT_DEAD_LETTER_JOB_NAME = "data-export-dead-letter-job";
export const DATA_EXPORT_EXPIRE_JOB_NAME = "data-export-expire-job";
export const DATA_EXPORT_SWEEP_JOB_NAME = "data-export-sweep-job";

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
	DATA_EXPORT_SWEEP_JOB_NAME,
	ACTIVITY_CLEANUP_JOB_NAME,
	RECONCILE_EMBEDDINGS_JOB_NAME,
	PREPARE_ASSETS_AGAIN_JOB_NAME,
	PREPARATION_SWEEP_JOB_NAME,
	DELETION_CLEANUP_JOB_NAME,
]);

export type JobQueue = z.infer<typeof jobQueues>;
