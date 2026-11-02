import { describe, expect, test } from "bun:test";
import {
	DB,
	DbConfigLive,
	DbConfigService,
	DrizzleLive,
	dbSchema,
	makePgConnectionString,
} from "@orcai/db";
import { PgBoss, PgBossService, TestClock } from "@orcai/pg-boss";
import {
	type EmailDeliveryChannel,
	NOTIFICATION_OUTBOX_JOB_NAME,
} from "@orcai/schema";
import { eq, sql } from "drizzle-orm";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import {
	EmailService,
	notificationOutboxValues,
	processNextNotification,
	wakeNotificationWorker,
} from "../src";

class Rollback<A> extends Data.TaggedError("Rollback")<{
	readonly value: A;
}> {}

const emailVia = (channel: EmailDeliveryChannel) =>
	Layer.succeed(EmailService, {
		send: () =>
			Effect.succeed({
				channel,
			}),
	});

/** A due row that is processed first, ahead of the stack's own. */
const insertOldestRow = Effect.gen(function* () {
	const db = yield* DB;
	const suffix = crypto.randomUUID();
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
				`outbox-${suffix}`,
			),
			nextAttemptAt: new Date("2000-01-01T00:00:00.000Z"),
			createdAt: new Date("2000-01-01T00:00:00.000Z"),
		})
		.returning();
	return row;
});

/** Runs `scenario` in a rolled-back transaction, so a drain leaves other files' rows alone. */
const rolledBack = <E, R>(scenario: Effect.Effect<string, E, R>) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db
			.transaction(() =>
				Effect.gen(function* () {
					const rowId = yield* Effect.orDie(scenario);
					const [seen] = yield* db
						.select()
						.from(dbSchema.notificationOutbox)
						.where(eq(dbSchema.notificationOutbox.id, rowId));
					return yield* new Rollback({
						value: seen,
					});
				}),
			)
			.pipe(Effect.catchTag("Rollback", ({ value }) => Effect.succeed(value)));
	});

describe("notification outbox", () => {
	for (const channel of [
		"smtp",
		"log",
	] as const) {
		test(`records ${channel} delivery on the sent row`, async () => {
			const row = await Effect.runPromise(
				rolledBack(
					Effect.gen(function* () {
						const row = yield* insertOldestRow;
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

/** pg-boss in a schema of its own on a hand-driven clock: no other file wakes its queue. */
const isolatedPgBoss = (clock: TestClock) =>
	Layer.effect(
		PgBossService,
		Effect.acquireRelease(
			Effect.gen(function* () {
				const { config } = yield* DbConfigService;
				const schema = `outbox_wake_${crypto.randomUUID().replaceAll("-", "")}`;
				const boss = new PgBoss({
					connectionString: Redacted.value(
						makePgConnectionString(config.postgres),
					),
					schema,
					clock,
				});
				yield* Effect.promise(() => boss.start());
				yield* Effect.promise(() =>
					boss.createQueue(NOTIFICATION_OUTBOX_JOB_NAME),
				);
				return {
					boss,
					schema,
				};
			}),
			({ boss, schema }) =>
				Effect.gen(function* () {
					const db = yield* DB;
					yield* Effect.promise(() =>
						boss.stop({
							graceful: false,
						}),
					);
					yield* db
						.execute(sql.raw(`DROP SCHEMA ${schema} CASCADE`))
						.pipe(Effect.orDie);
				}),
		),
	).pipe(Layer.provide(DbConfigLive));

test("a row added while a drain runs is drained after the next wake", async () => {
	// Time stands still until the tick, so both wakes fall into one slot.
	const clock = new TestClock("2026-01-01T00:00:01.000Z");
	const row = await Effect.runPromise(
		rolledBack(
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
				const row = yield* insertOldestRow;
				yield* wakeNotificationWorker;
				yield* Effect.promise(() => clock.tick(10_000));
				yield* work;
				return row.id;
			}),
		).pipe(
			Effect.provide(
				isolatedPgBoss(clock).pipe(
					Layer.provideMerge(Layer.mergeAll(DrizzleLive, emailVia("log"))),
				),
			),
		),
	);
	expect(row).toMatchObject({
		status: "sent",
	});
});
