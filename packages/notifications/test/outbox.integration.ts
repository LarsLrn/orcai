import { describe, expect, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import { DB, DrizzleLive, dbSchema } from "@orcai/db";
import {
	type JobWithMetadata,
	makePgBossLayer,
	PgBossService,
} from "@orcai/pg-boss";
import {
	type EmailDeliveryChannel,
	NOTIFICATION_OUTBOX_JOB_NAME,
} from "@orcai/schema";
import { eq } from "drizzle-orm";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
	EmailService,
	notificationOutboxValues,
	processNextNotification,
	wakeNotificationWorker,
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

// The wake's singleton slot, as pg-boss buckets it.
const SLOT_MS = 5_000;
const slotOf = (job: Pick<JobWithMetadata, "singletonOn">) =>
	job.singletonOn?.getTime() ?? 0;

test("a wake in a slot whose drain already started queues a drain in a later slot", async () => {
	// Start just after a slot boundary, so both wakes fall into one slot.
	await sleep(SLOT_MS - (Date.now() % SLOT_MS) + 100);
	const slotEnd = Date.now() - (Date.now() % SLOT_MS) + SLOT_MS;
	const { drain, next, inSlot } = await Effect.runPromise(
		Effect.gen(function* () {
			const { boss } = yield* PgBossService;
			yield* Effect.promise(() =>
				boss.createQueue(NOTIFICATION_OUTBOX_JOB_NAME),
			);
			yield* wakeNotificationWorker;
			// The worker takes every waiting drain, so a row inserted now needs a new one.
			const draining = yield* Effect.promise(() =>
				boss.fetch(NOTIFICATION_OUTBOX_JOB_NAME, {
					batchSize: 1000,
					includeMetadata: true,
				}),
			);
			const drain = draining
				.filter((job) => job.singletonOn !== null)
				.sort((a, b) => slotOf(b) - slotOf(a))
				.at(0);
			yield* wakeNotificationWorker;
			const inSlot = Date.now() < slotEnd;
			const next = (yield* Effect.promise(() =>
				boss.findJobs(NOTIFICATION_OUTBOX_JOB_NAME, {
					queued: true,
				}),
			)).filter((job) => drain && slotOf(job) > slotOf(drain));
			for (const ids of [
				draining.map((job) => job.id),
				next.map((job) => job.id),
			]) {
				if (ids.length === 0) continue;
				yield* Effect.promise(() =>
					boss.deleteJob(NOTIFICATION_OUTBOX_JOB_NAME, ids),
				);
			}
			return {
				drain,
				next,
				inSlot,
			};
		}).pipe(
			Effect.provide(
				makePgBossLayer({
					instanceName: "notifications-integration",
				}),
			),
		),
	);
	expect(drain).toBeDefined();
	expect(inSlot).toBe(true);
	expect(next).toHaveLength(1);
}, 15_000);
