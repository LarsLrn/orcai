import { afterEach, expect, test } from "bun:test";
import { DB, dbSchema } from "@orcai/db";
import { PgBossService } from "@orcai/pg-boss";
import { integrationRuntime } from "@orcai/testing";
import { inArray } from "drizzle-orm";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { enqueueNotification, enqueueNotifications } from "../src";

const runtime = integrationRuntime();

/** A queue that counts wakes, or rejects them when `failing`. */
const wakeCounter = ({ failing }: { failing: boolean }) => {
	const counter = {
		wakes: 0,
		service: {
			boss: {
				sendDebounced: () => {
					counter.wakes++;
					return failing
						? Promise.reject(new Error("queue unavailable"))
						: Promise.resolve(null);
				},
			},
			schema: "pgboss",
		} as unknown as PgBossService["Service"],
	};
	return counter;
};

const queuedKeys: string[] = [];
afterEach(() =>
	runtime.runPromise(
		Effect.gen(function* () {
			const keys = queuedKeys.splice(0);
			if (keys.length === 0) return;
			yield* (yield* DB)
				.delete(dbSchema.notificationOutbox)
				.where(inArray(dbSchema.notificationOutbox.deduplicationKey, keys));
		}),
	),
);

const testEmail = () => {
	const deduplicationKey = `enqueue-${crypto.randomUUID()}`;
	queuedKeys.push(deduplicationKey);
	return {
		notification: {
			type: "instance.test-email" as const,
			recipient: `${deduplicationKey}@example.test`,
			locale: "en" as const,
			healthUrl: "https://example.test/instance/health",
		},
		deduplicationKey,
	};
};

const storedKeys = (keys: readonly string[]) =>
	Effect.gen(function* () {
		const rows = yield* (yield* DB)
			.select({
				deduplicationKey: dbSchema.notificationOutbox.deduplicationKey,
			})
			.from(dbSchema.notificationOutbox)
			.where(
				inArray(dbSchema.notificationOutbox.deduplicationKey, [
					...keys,
				]),
			);
		return rows.map((row) => row.deduplicationKey).sort();
	});

class Abort extends Data.TaggedError("Abort") {}

test("queues each deduplication key once", async () => {
	const queue = wakeCounter({
		failing: false,
	});
	const first = testEmail();
	const second = testEmail();
	const result = await runtime.runPromise(
		Effect.gen(function* () {
			const earlier = yield* enqueueNotifications([
				first,
			]);
			const later = yield* enqueueNotifications([
				first,
				second,
				second,
			]);
			const again = yield* enqueueNotifications([
				first,
				second,
			]);
			return {
				earlier,
				later,
				again,
				stored: yield* storedKeys([
					first.deduplicationKey,
					second.deduplicationKey,
				]),
			};
		}).pipe(Effect.provideService(PgBossService, queue.service)),
	);
	expect(result).toEqual({
		earlier: [
			first.deduplicationKey,
		],
		later: [
			second.deduplicationKey,
		],
		again: [],
		stored: [
			first.deduplicationKey,
			second.deduplicationKey,
		].sort(),
	});
	expect(queue.wakes).toBe(2);
});

test("wakes the worker once the transaction commits", async () => {
	const queue = wakeCounter({
		failing: false,
	});
	const emails = [
		testEmail(),
		testEmail(),
	];
	const wakesInTransaction = await runtime.runPromise(
		Effect.gen(function* () {
			const db = yield* DB;
			return yield* db.transaction(() =>
				Effect.gen(function* () {
					yield* enqueueNotifications(emails);
					return queue.wakes;
				}),
			);
		}).pipe(Effect.provideService(PgBossService, queue.service)),
	);
	expect(wakesInTransaction).toBe(0);
	expect(queue.wakes).toBe(1);
});

test("a transaction that queues several times wakes the worker once", async () => {
	const queue = wakeCounter({
		failing: false,
	});
	const emails = [
		testEmail(),
		testEmail(),
		testEmail(),
	];
	await runtime.runPromise(
		Effect.gen(function* () {
			const db = yield* DB;
			yield* db.transaction(() =>
				Effect.gen(function* () {
					yield* enqueueNotifications([
						emails[0],
					]);
					yield* db.transaction(() =>
						enqueueNotifications([
							emails[1],
						]),
					);
					yield* enqueueNotifications([
						emails[2],
					]);
				}),
			);
		}).pipe(Effect.provideService(PgBossService, queue.service)),
	);
	expect(queue.wakes).toBe(1);
});

for (const queuedKept of [
	"before",
	"after",
] as const) {
	test(`a rolled-back savepoint keeps the wake of rows queued ${queuedKept} it`, async () => {
		const queue = wakeCounter({
			failing: false,
		});
		const discarded = testEmail();
		const kept = testEmail();
		const queueKept = enqueueNotifications([
			kept,
		]);
		const stored = await runtime.runPromise(
			Effect.gen(function* () {
				const db = yield* DB;
				yield* db.transaction(() =>
					Effect.gen(function* () {
						if (queuedKept === "before") yield* queueKept;
						yield* db
							.transaction(() =>
								enqueueNotifications([
									discarded,
								]).pipe(Effect.andThen(Effect.fail(new Abort()))),
							)
							.pipe(Effect.catchTag("Abort", () => Effect.void));
						if (queuedKept === "after") yield* queueKept;
					}),
				);
				return yield* storedKeys([
					discarded.deduplicationKey,
					kept.deduplicationKey,
				]);
			}).pipe(Effect.provideService(PgBossService, queue.service)),
		);
		expect(stored).toEqual([
			kept.deduplicationKey,
		]);
		expect(queue.wakes).toBe(1);
	});
}

test("a rolled-back transaction queues nothing and wakes nobody", async () => {
	const queue = wakeCounter({
		failing: false,
	});
	const email = testEmail();
	const stored = await runtime.runPromise(
		Effect.gen(function* () {
			const db = yield* DB;
			yield* db
				.transaction(() =>
					enqueueNotifications([
						email,
					]).pipe(Effect.andThen(Effect.fail(new Abort()))),
				)
				.pipe(Effect.catchTag("Abort", () => Effect.void));
			return yield* storedKeys([
				email.deduplicationKey,
			]);
		}).pipe(Effect.provideService(PgBossService, queue.service)),
	);
	expect(stored).toEqual([]);
	expect(queue.wakes).toBe(0);
});

test("a failed wake keeps the committed notification queued", async () => {
	const queue = wakeCounter({
		failing: true,
	});
	const email = testEmail();
	const result = await runtime.runPromise(
		Effect.gen(function* () {
			const db = yield* DB;
			const queued = yield* db.transaction(() =>
				enqueueNotification(email.notification, email.deduplicationKey),
			);
			return {
				queued,
				stored: yield* storedKeys([
					email.deduplicationKey,
				]),
			};
		}).pipe(Effect.provideService(PgBossService, queue.service)),
	);
	expect(result).toEqual({
		queued: true,
		stored: [
			email.deduplicationKey,
		],
	});
	expect(queue.wakes).toBe(1);
});
