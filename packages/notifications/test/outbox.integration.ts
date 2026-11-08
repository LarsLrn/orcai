import { describe, expect, test } from "bun:test";
import { DB, DrizzleLive, dbSchema } from "@orcai/db";
import { PgBossService, TestClock } from "@orcai/pg-boss";
import { IsolatedPgBossLive } from "@orcai/pg-boss/testing";
import {
	type EmailDeliveryChannel,
	NOTIFICATION_OUTBOX_JOB_NAME,
} from "@orcai/schema";
import { rolledBack } from "@orcai/testing";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
	EmailService,
	processNextNotification,
	wakeNotificationWorker,
} from "../src";
import { insertOldestRow } from "./outbox-rows";

const emailVia = (channel: EmailDeliveryChannel) =>
	Layer.succeed(EmailService, {
		send: () =>
			Effect.succeed({
				channel,
			}),
	});

/** The row `scenario` returns the id of, as it stands at the end of a rolled-back transaction. */
const rolledBackRow = <E, R>(scenario: Effect.Effect<string, E, R>) =>
	rolledBack(
		Effect.gen(function* () {
			const rowId = yield* Effect.orDie(scenario);
			const [seen] = yield* (yield* DB)
				.select()
				.from(dbSchema.notificationOutbox)
				.where(eq(dbSchema.notificationOutbox.id, rowId));
			return seen;
		}),
	);

describe("notification outbox", () => {
	for (const channel of [
		"smtp",
		"log",
	] as const) {
		test(`records ${channel} delivery on the sent row`, async () => {
			const row = await Effect.runPromise(
				rolledBackRow(
					Effect.gen(function* () {
						const row = yield* insertOldestRow();
						yield* processNextNotification();
						return row.id;
					}),
				).pipe(Effect.provide(Layer.mergeAll(DrizzleLive, emailVia(channel)))),
			);
			expect(row).toMatchObject({
				status: "sent",
				deliveryChannel: channel,
			});
		});
	}
});

test("a row added while a drain runs is drained after the next wake", async () => {
	// Time stands still until the tick, so both wakes fall into one slot.
	const clock = new TestClock("2026-01-01T00:00:01.000Z");
	const row = await Effect.runPromise(
		rolledBackRow(
			Effect.gen(function* () {
				const { boss } = yield* PgBossService;
				// What the worker does with each drain it fetches.
				const work = Effect.gen(function* () {
					const drains = yield* Effect.promise(() =>
						boss.fetch(NOTIFICATION_OUTBOX_JOB_NAME, {
							batchSize: 10,
						}),
					);
					for (const _ of drains) yield* processNextNotification();
				});
				yield* wakeNotificationWorker;
				yield* work;
				// The drain is still running and has already looked for rows.
				const row = yield* insertOldestRow();
				yield* wakeNotificationWorker;
				yield* Effect.promise(() => clock.tick(10_000));
				yield* work;
				return row.id;
			}),
		).pipe(
			Effect.provide(
				IsolatedPgBossLive({
					clock,
				}).pipe(
					Layer.provideMerge(Layer.mergeAll(DrizzleLive, emailVia("log"))),
				),
			),
		),
	);
	expect(row).toMatchObject({
		status: "sent",
	});
});
