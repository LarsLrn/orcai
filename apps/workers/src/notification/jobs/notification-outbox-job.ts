import {
	cleanupNotificationOutbox,
	processNextNotification,
} from "@orcai/notifications";
import type { Job } from "@orcai/pg-boss";
import * as Effect from "effect/Effect";

export const processNotificationOutboxBatch = (_jobs: Job<unknown>[]) =>
	Effect.gen(function* () {
		for (let processed = 0; processed < 250; processed++) {
			const didProcess = yield* processNextNotification();
			if (!didProcess) break;
		}
	});

export const cleanupNotificationOutboxBatch = (_jobs: Job<unknown>[]) =>
	cleanupNotificationOutbox.pipe(Effect.asVoid);
