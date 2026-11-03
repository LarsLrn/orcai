import { defineWorker } from "@orcai/pg-boss";
import {
	NOTIFICATION_OUTBOX_CLEANUP_JOB_NAME,
	NOTIFICATION_OUTBOX_JOB_NAME,
} from "@orcai/schema";
import {
	cleanupNotifications,
	drainNotificationOutbox,
} from "@/notification/jobs/notification-outbox-job";

export const notificationWorkers = [
	defineWorker({
		queue: NOTIFICATION_OUTBOX_JOB_NAME,
		concurrency: 4,
		pollingIntervalSeconds: 2,
		handler: () => drainNotificationOutbox,
	}),
	defineWorker({
		queue: NOTIFICATION_OUTBOX_CLEANUP_JOB_NAME,
		concurrency: 1,
		pollingIntervalSeconds: 30,
		handler: () => cleanupNotifications,
	}),
];
