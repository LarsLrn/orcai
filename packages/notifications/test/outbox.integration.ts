import { describe, expect, test } from "bun:test";
import { DB, DrizzleLive, dbSchema } from "@orcai/db";
import type { EmailDeliveryChannel } from "@orcai/schema";
import { eq } from "drizzle-orm";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
	EmailService,
	notificationOutboxValues,
	processNextNotification,
} from "../src";

class Rollback<A> extends Data.TaggedError("Rollback")<{
	readonly value: A;
}> {}

const deliverOne = (channel: EmailDeliveryChannel) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const suffix = crypto.randomUUID();
		return yield* db
			.transaction(() =>
				Effect.gen(function* () {
					// The oldest due row is processed first, ahead of the stack's own.
					const [row] = yield* db
						.insert(dbSchema.notificationOutbox)
						.values({
							...notificationOutboxValues(
								{
									type: "instance.test-email",
									recipient: `admin-${suffix}@example.test`,
									locale: "en",
									healthUrl: "https://example.test/instance/health",
								},
								`outbox-channel-${suffix}`,
							),
							nextAttemptAt: new Date("2000-01-01T00:00:00.000Z"),
							createdAt: new Date("2000-01-01T00:00:00.000Z"),
						})
						.returning();
					yield* processNextNotification();
					const [sent] = yield* db
						.select()
						.from(dbSchema.notificationOutbox)
						.where(eq(dbSchema.notificationOutbox.id, row.id));
					return yield* new Rollback({
						value: sent,
					});
				}),
			)
			.pipe(Effect.catchTag("Rollback", ({ value }) => Effect.succeed(value)));
	}).pipe(
		Effect.provide(
			Layer.mergeAll(
				DrizzleLive,
				Layer.succeed(EmailService, {
					send: () =>
						Effect.succeed({
							channel,
						}),
				}),
			),
		),
	);

describe("notification outbox", () => {
	for (const channel of [
		"smtp",
		"log",
	] as const) {
		test(`records ${channel} delivery on the sent row`, async () => {
			const row = await Effect.runPromise(deliverOne(channel));
			expect(row).toMatchObject({
				status: "sent",
				deliveryChannel: channel,
			});
		});
	}
});
