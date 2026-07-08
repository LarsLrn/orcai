import type { DB } from "@orcai/db";
import type { EmailService } from "@orcai/notifications";
import type { PgBossService } from "@orcai/pg-boss";
import {
	NOTIFICATION_OUTBOX_CLEANUP_JOB_NAME,
	NOTIFICATION_OUTBOX_JOB_NAME,
} from "@orcai/schema";
import {
	cleanupNotificationOutboxBatch,
	processNotificationOutboxBatch,
} from "@/notification/jobs/notification-outbox-job";
import type { WorkerDefinition } from "@/worker/types";

export type NotificationWorkerContext = DB | PgBossService | EmailService;

export const notificationWorkerDefinitions = [
	{
		name: NOTIFICATION_OUTBOX_JOB_NAME,
		schedule: "* * * * *",
		workOptions: {
			batchSize: 1,
			localConcurrency: 4,
			pollingIntervalSeconds: 2,
		},
		handler: processNotificationOutboxBatch,
	},
	{
		name: NOTIFICATION_OUTBOX_CLEANUP_JOB_NAME,
		schedule: "15 2 * * *",
		workOptions: {
			batchSize: 1,
			localConcurrency: 1,
			pollingIntervalSeconds: 30,
		},
		handler: cleanupNotificationOutboxBatch,
	},
] as const satisfies readonly WorkerDefinition<
	NotificationWorkerContext,
	unknown
>[];
