import { afterEach, expect, setSystemTime, test } from "bun:test";
import { DB, dbSchema } from "@orcai/db";
import { integrationRuntime, rolledBack } from "@orcai/testing";
import { eq } from "drizzle-orm";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import { EmailError, EmailService, processNextNotification } from "../src";
import { drainAgain, insertOldestRow, storedRow } from "./outbox-rows";

const runtime = integrationRuntime();

afterEach(() => {
	setSystemTime();
});

/** Past the longest wait between two attempts. */
const RETRY_WAIT_MS = 25 * 60 * 60_000;

/** Moves this process's clock forward; the database keeps its own. */
const advanceClock = (ms: number) =>
	Effect.sync(() => {
		setSystemTime(new Date(Date.now() + ms));
	});

const SENSITIVE_FAILURE =
	"550 mailbox someone@example.test refused https://example.test/reset?token=secret";

const failingSender = {
	send: () =>
		Effect.fail(
			new EmailError({
				operation: "send",
				cause: new Error(SENSITIVE_FAILURE),
			}),
		),
};

const failOnce = processNextNotification().pipe(
	Effect.provideService(EmailService, failingSender),
);

const expectSanitized = (lastError: string | null) => {
	expect(lastError).toBeString();
	expect(lastError).not.toContain("someone@example.test");
	expect(lastError).not.toContain("token=secret");
};

test("a failed delivery waits, then is sent on a later attempt", async () => {
	const { row, failed, retriedAtOnce, retriedLater, sent } =
		await runtime.runPromise(
			rolledBack(
				Effect.gen(function* () {
					const row = yield* insertOldestRow();
					yield* failOnce;
					const failed = yield* storedRow(row.id);
					const retriedAtOnce = yield* drainAgain;
					yield* advanceClock(RETRY_WAIT_MS);
					const retriedLater = yield* drainAgain;
					return {
						row,
						failed,
						retriedAtOnce,
						retriedLater,
						sent: yield* storedRow(row.id),
					};
				}),
			),
		);

	expect(failed).toMatchObject({
		status: "pending",
		payload: row.payload,
		leaseExpiresAt: null,
	});
	expectSanitized(failed.lastError);
	expect(retriedAtOnce).not.toContain(row.recipient);
	expect(retriedLater).toEqual([
		row.recipient,
	]);
	expect(sent).toMatchObject({
		status: "sent",
		lastError: null,
	});
	expect(sent.payload).toEqual({});
});

test("a delivery that fails on every attempt ends dead, its payload cleared and its error sanitized", async () => {
	const { row, dead, sentAgainTo } = await runtime.runPromise(
		rolledBack(
			Effect.gen(function* () {
				const row = yield* insertOldestRow();
				let attempts = 0;
				while ((yield* storedRow(row.id)).status === "pending") {
					yield* failOnce;
					yield* advanceClock(RETRY_WAIT_MS);
					attempts++;
					if (attempts > 20) return yield* Effect.die("Never gave up");
				}
				return {
					row,
					dead: yield* storedRow(row.id),
					sentAgainTo: yield* drainAgain,
				};
			}),
		),
	);

	expect(dead).toMatchObject({
		status: "dead",
		attempts: 10,
		leaseExpiresAt: null,
	});
	expect(dead.payload).toEqual({});
	expectSanitized(dead.lastError);
	expect(sentAgainTo).not.toContain(row.recipient);
});

test("a row whose payload no longer validates ends dead without a send", async () => {
	const { dead, sentTo } = await runtime.runPromise(
		rolledBack(
			Effect.gen(function* () {
				const row = yield* insertOldestRow({
					payload: {
						type: "instance.test-email",
					},
				});
				const sentTo = yield* drainAgain;
				return {
					dead: yield* storedRow(row.id),
					sentTo,
				};
			}),
		),
	);

	expect(sentTo).toEqual([]);
	expect(dead).toMatchObject({
		status: "dead",
	});
	expect(dead.payload).toEqual({});
});

test("two workers claiming at once deliver a row once", async () => {
	// Due only on this process's clock, so other test files never claim it.
	const due = new Date("2200-01-01");
	const deliveries = await runtime.runPromise(
		Effect.gen(function* () {
			const row = yield* insertOldestRow({
				nextAttemptAt: due,
			});
			return yield* Effect.gen(function* () {
				yield* advanceClock(due.getTime() - Date.now() + 60_000);
				const release = yield* Deferred.make<void>();
				const recipients: string[] = [];
				/** Claims in a transaction of its own, which stays open until `release`. */
				const worker = Effect.gen(function* () {
					const claimed = yield* Deferred.make<void>();
					const fiber = yield* rolledBack(
						processNextNotification().pipe(
							Effect.provideService(EmailService, {
								send: ({ to }) =>
									Effect.sync(() => recipients.push(to)).pipe(
										Effect.andThen(Deferred.succeed(claimed, undefined)),
										Effect.andThen(Deferred.await(release)),
										Effect.as({
											channel: "log" as const,
										}),
									),
							}),
							Effect.ensuring(Deferred.succeed(claimed, undefined)),
							Effect.andThen(Deferred.await(release)),
						),
					).pipe(Effect.forkChild);
					return {
						claimed,
						fiber,
					};
				});
				const workers = yield* Effect.all([
					worker,
					worker,
				]);
				const bothClaimed = yield* Effect.exit(
					Effect.forEach(workers, ({ claimed }) =>
						Deferred.await(claimed),
					).pipe(Effect.timeout("3 seconds")),
				);
				yield* Deferred.succeed(release, undefined);
				yield* Effect.forEach(workers, ({ fiber }) => Fiber.join(fiber));
				if (Exit.isFailure(bothClaimed))
					return yield* Effect.die("A worker waited for the other's claim");
				return recipients.filter((to) => to === row.recipient);
			}).pipe(
				Effect.ensuring(
					Effect.gen(function* () {
						yield* (yield* DB)
							.delete(dbSchema.notificationOutbox)
							.where(eq(dbSchema.notificationOutbox.id, row.id));
					}).pipe(Effect.ignore),
				),
			);
		}),
	);

	expect(deliveries).toHaveLength(1);
});
