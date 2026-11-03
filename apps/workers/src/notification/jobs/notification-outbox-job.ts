import {
	cleanupNotificationOutbox,
	processNextNotification,
} from "@orcai/notifications";
import * as Effect from "effect/Effect";

export const drainNotificationOutbox = Effect.gen(function* () {
	for (let processed = 0; processed < 250; processed++) {
		const didProcess = yield* processNextNotification();
		if (!didProcess) break;
	}
});

export const cleanupNotifications = cleanupNotificationOutbox.pipe(
	Effect.asVoid,
);
