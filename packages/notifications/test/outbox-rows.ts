import { DB, dbSchema } from "@orcai/db";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	EmailService,
	notificationOutboxValues,
	processNextNotification,
} from "../src";

type OutboxInsert = typeof dbSchema.notificationOutbox.$inferInsert;

/** A due row that is claimed first, ahead of the stack's own. */
export const insertOldestRow = (overrides: Partial<OutboxInsert> = {}) =>
	Effect.gen(function* () {
		const suffix = crypto.randomUUID();
		const [row] = yield* (yield* DB)
			.insert(dbSchema.notificationOutbox)
			.values({
				...notificationOutboxValues(
					{
						type: "instance.test-email",
						recipient: `admin-${suffix}@example.test`,
						locale: "en",
						healthUrl: "https://example.test/instance/health",
					},
					`outbox-${suffix}`,
				),
				createdAt: new Date("1900-01-01"),
				nextAttemptAt: new Date("1900-01-01"),
				...overrides,
			})
			.returning();
		return row;
	});

export const storedRow = (id: string) =>
	Effect.gen(function* () {
		const [stored] = yield* (yield* DB)
			.select()
			.from(dbSchema.notificationOutbox)
			.where(eq(dbSchema.notificationOutbox.id, id));
		return stored;
	});

/** Drains one more row and returns the recipients it sent to. */
export const drainAgain = Effect.gen(function* () {
	const recipients: string[] = [];
	yield* processNextNotification().pipe(
		Effect.provideService(EmailService, {
			send: ({ to }) =>
				Effect.sync(() => {
					recipients.push(to);
					return {
						channel: "log" as const,
					};
				}),
		}),
	);
	return recipients;
});
