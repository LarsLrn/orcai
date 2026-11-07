// I4: an expired sender must not undo a newer delivery result.
import { expect, test } from "bun:test";
import { DB, dbSchema } from "@orcai/db";
import { integrationRuntime, rolledBack } from "@orcai/testing";
import { eq } from "drizzle-orm";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as TestClock from "effect/testing/TestClock";
import {
	EmailError,
	EmailService,
	notificationOutboxValues,
	processNextNotification,
} from "../src";

const runtime = integrationRuntime();

/** A due row that is claimed first, ahead of any other. */
const insertOldestRow = Effect.gen(function* () {
	const [row] = yield* (yield* DB)
		.insert(dbSchema.notificationOutbox)
		.values({
			...notificationOutboxValues(
				{
					type: "instance.test-email",
					recipient: `${crypto.randomUUID()}@example.test`,
					locale: "en",
					healthUrl: "https://example.test/health",
				},
				crypto.randomUUID(),
			),
			createdAt: new Date("1900-01-01"),
			nextAttemptAt: new Date("1900-01-01"),
		})
		.returning();
	return row;
});

const storedRow = (id: string) =>
	Effect.gen(function* () {
		const [stored] = yield* (yield* DB)
			.select()
			.from(dbSchema.notificationOutbox)
			.where(eq(dbSchema.notificationOutbox.id, id));
		return stored;
	});

const expireLease = (id: string) =>
	Effect.gen(function* () {
		yield* (yield* DB)
			.update(dbSchema.notificationOutbox)
			.set({
				leaseExpiresAt: new Date(0),
			})
			.where(eq(dbSchema.notificationOutbox.id, id));
	});

/** A sender that signals once it starts, then waits for `release` and gives `outcome`. */
const heldSender = <A>(
	entered: Deferred.Deferred<void>,
	release: Deferred.Deferred<void>,
	outcome: Effect.Effect<A, EmailError>,
) => ({
	send: () =>
		Deferred.succeed(entered, undefined).pipe(
			Effect.andThen(Deferred.await(release)),
			Effect.andThen(outcome),
		),
});

const failedSend = Effect.fail(
	new EmailError({
		operation: "send",
		cause: "old sender failed",
	}),
);

const replacementDelivery = Effect.succeed({
	channel: "log" as const,
	messageId: "replacement-delivery",
});

/** Drains one more row and returns the recipients it sent to. */
const drainAgain = Effect.gen(function* () {
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

test("an expired sender cannot restore a payload after its replacement records delivery", async () => {
	const { row, sentAgainTo } = await runtime.runPromise(
		rolledBack(
			Effect.gen(function* () {
				const entered = yield* Deferred.make<void>();
				const release = yield* Deferred.make<void>();
				const row = yield* insertOldestRow;
				const oldSender = yield* processNextNotification().pipe(
					Effect.provideService(
						EmailService,
						heldSender(entered, release, failedSend),
					),
					Effect.forkChild,
				);
				yield* Deferred.await(entered);
				try {
					yield* expireLease(row.id);
					yield* processNextNotification().pipe(
						Effect.provideService(EmailService, {
							send: () => replacementDelivery,
						}),
					);
				} finally {
					yield* Deferred.succeed(release, undefined);
					yield* Fiber.join(oldSender);
				}
				return {
					row: yield* storedRow(row.id),
					sentAgainTo: yield* drainAgain,
				};
			}),
		),
	);
	expect(row).toMatchObject({
		status: "sent",
		payload: {},
		providerMessageId: "replacement-delivery",
		deliveryChannel: "log",
	});
	expect(sentAgainTo).not.toContain(row.recipient);
});

test("an expired sender leaves the row to a replacement that is still sending", async () => {
	const { whileSending, settled } = await runtime.runPromise(
		rolledBack(
			Effect.gen(function* () {
				const oldEntered = yield* Deferred.make<void>();
				const oldRelease = yield* Deferred.make<void>();
				const newEntered = yield* Deferred.make<void>();
				const newRelease = yield* Deferred.make<void>();
				const row = yield* insertOldestRow;
				const oldSender = yield* processNextNotification().pipe(
					Effect.provideService(
						EmailService,
						heldSender(oldEntered, oldRelease, failedSend),
					),
					Effect.forkChild,
				);
				yield* Deferred.await(oldEntered);
				yield* expireLease(row.id);
				const newSender = yield* processNextNotification().pipe(
					Effect.provideService(
						EmailService,
						heldSender(newEntered, newRelease, replacementDelivery),
					),
					Effect.forkChild,
				);
				yield* Deferred.await(newEntered);
				yield* Deferred.succeed(oldRelease, undefined);
				yield* Fiber.join(oldSender);
				const whileSending = yield* storedRow(row.id);
				yield* Deferred.succeed(newRelease, undefined);
				yield* Fiber.join(newSender);
				return {
					whileSending,
					settled: yield* storedRow(row.id),
				};
			}),
		),
	);
	expect(whileSending).toMatchObject({
		status: "processing",
		attempts: 2,
		lastError: null,
	});
	expect(settled).toMatchObject({
		status: "sent",
		attempts: 2,
		providerMessageId: "replacement-delivery",
	});
});

test("claims that crash before settling use up the attempt limit", async () => {
	const { row, sentAgainTo } = await runtime.runPromise(
		rolledBack(
			Effect.gen(function* () {
				const row = yield* insertOldestRow;
				for (let claim = 0; claim < 10; claim++) {
					const entered = yield* Deferred.make<void>();
					const crashed = yield* processNextNotification().pipe(
						Effect.provideService(EmailService, {
							send: () =>
								Deferred.succeed(entered, undefined).pipe(
									Effect.andThen(Effect.never),
								),
						}),
						Effect.forkChild,
					);
					yield* Deferred.await(entered);
					yield* Fiber.interrupt(crashed);
					yield* expireLease(row.id);
				}
				return {
					sentAgainTo: yield* drainAgain,
					row: yield* storedRow(row.id),
				};
			}),
		),
	);
	expect(sentAgainTo).not.toContain(row.recipient);
	expect(row).toMatchObject({
		status: "dead",
		attempts: 10,
		payload: {},
		leaseExpiresAt: null,
	});
});

test("a delivery that hangs gives the row back before its lease expires", async () => {
	const row = await runtime.runPromise(
		rolledBack(
			Effect.gen(function* () {
				const row = yield* insertOldestRow;
				const entered = yield* Deferred.make<void>();
				const sender = yield* processNextNotification().pipe(
					Effect.provideService(EmailService, {
						send: () =>
							Deferred.succeed(entered, undefined).pipe(
								Effect.andThen(Effect.never),
							),
					}),
					Effect.forkChild,
				);
				yield* Deferred.await(entered);
				const claimed = yield* storedRow(row.id);
				const lease =
					(claimed.leaseExpiresAt?.getTime() ?? 0) -
					claimed.updatedAt.getTime();
				yield* TestClock.adjust(lease - 1);
				yield* Fiber.join(sender);
				return yield* storedRow(row.id);
			}).pipe(Effect.provide(TestClock.layer())),
		),
	);
	expect(row).toMatchObject({
		status: "pending",
		attempts: 1,
		leaseExpiresAt: null,
	});
	expect(row.lastError).toBeString();
});
